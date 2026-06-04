from rest_framework import permissions

from .models import StaffProfile


CLINICAL_WRITE_ROLES = {
    StaffProfile.Role.SYSTEM_ADMIN,
    StaffProfile.Role.HOSPITAL_ADMIN,
    StaffProfile.Role.HEAD_PHYSICIAN,
    StaffProfile.Role.PHYSICIAN,
    StaffProfile.Role.NURSE,
}

ADMIN_ROLES = {
    StaffProfile.Role.SYSTEM_ADMIN,
    StaffProfile.Role.HOSPITAL_ADMIN,
}

GOVERNANCE_ROLES = {
    StaffProfile.Role.SYSTEM_ADMIN,
    StaffProfile.Role.HOSPITAL_ADMIN,
    StaffProfile.Role.HEAD_PHYSICIAN,
    StaffProfile.Role.COMPLIANCE_OFFICER,
    StaffProfile.Role.AUDITOR,
}


def staff_profile_for(user):
    if not user or not user.is_authenticated:
        return None
    if user.is_superuser:
        return None
    return getattr(user, "staff_profile", None)


class HasActiveStaffProfile(permissions.BasePermission):
    message = "An active staff profile is required."

    def has_permission(self, request, view) -> bool:
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser:
            return True
        profile = staff_profile_for(request.user)
        return bool(profile and profile.is_active_staff and profile.organization.is_active)


class IsTenantMember(HasActiveStaffProfile):
    message = "This object is outside the user's organization."

    def has_object_permission(self, request, view, obj) -> bool:
        if request.user.is_superuser:
            return True
        profile = staff_profile_for(request.user)
        if not profile:
            return False

        if isinstance(obj, StaffProfile):
            return obj.organization_id == profile.organization_id
        if obj.__class__.__name__ == "AccessGrant":
            return obj.staff_profile.organization_id == profile.organization_id
        if obj.__class__.__name__ == "Organization":
            return obj.id == profile.organization_id

        organization_id = getattr(obj, "organization_id", None)
        if organization_id is None and getattr(obj, "patient_id", None):
            organization_id = obj.patient.organization_id
        if organization_id is None and hasattr(obj, "medical_record"):
            organization_id = obj.medical_record.organization_id

        return organization_id == profile.organization_id


class IsClinicalWriter(IsTenantMember):
    message = "A clinical write role is required."

    def has_permission(self, request, view) -> bool:
        if not super().has_permission(request, view):
            return False
        if request.method in permissions.SAFE_METHODS:
            return True
        if request.user.is_superuser:
            return True
        profile = staff_profile_for(request.user)
        return bool(profile and profile.role in CLINICAL_WRITE_ROLES)


class IsOrganizationAdmin(IsTenantMember):
    message = "An organization administrator role is required."

    def has_permission(self, request, view) -> bool:
        if not super().has_permission(request, view):
            return False
        if request.user.is_superuser:
            return True
        profile = staff_profile_for(request.user)
        return bool(profile and profile.role in ADMIN_ROLES)


class IsGovernanceReader(IsTenantMember):
    message = "A governance or audit role is required."

    def has_permission(self, request, view) -> bool:
        if not super().has_permission(request, view):
            return False
        if request.user.is_superuser:
            return True
        profile = staff_profile_for(request.user)
        return bool(profile and profile.role in GOVERNANCE_ROLES)
