import { CrmWorkspace } from "@/components/crm/crm-workspace";
import { PatientProfile } from "@/components/crm/patient-profile";
import { patientById } from "@/lib/crm-data";

interface PatientProfilePageProps {
  params: Promise<{
    patientId: string;
  }>;
}

export default async function PatientProfilePage({ params }: PatientProfilePageProps) {
  const { patientId } = await params;
  const numericPatientId = Number(patientId);
  const patient = Number.isFinite(numericPatientId) ? patientById(numericPatientId) : undefined;

  return (
    <CrmWorkspace
      module="patients"
      headerTitle={patient?.fullName ?? "Bemor profili"}
      headerSubtitle={patient ? `${patient.medicalCard}, ${patient.territory}` : "Andijon tuman Qo'nji oilaviy shifokorlik punkti"}
      content={<PatientProfile patientId={numericPatientId} />}
    />
  );
}
