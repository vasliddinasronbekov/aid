import { CrmWorkspace } from "@/components/crm/crm-workspace";
import { PatientProfile } from "@/components/crm/patient-profile";

interface PatientProfilePageProps {
  params: Promise<{
    patientId: string;
  }>;
}

export default async function PatientProfilePage({ params }: PatientProfilePageProps) {
  const { patientId } = await params;
  const numericPatientId = Number(patientId);

  return (
    <CrmWorkspace
      module="patients"
      headerTitle="Bemor profili"
      headerSubtitle="Backend klinik profil"
      content={<PatientProfile patientId={numericPatientId} />}
    />
  );
}
