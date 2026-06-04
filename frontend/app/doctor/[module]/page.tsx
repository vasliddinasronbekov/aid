import { CrmWorkspace } from "@/components/crm/crm-workspace";
import { CrmModuleKey, isCrmModule } from "@/lib/crm-data";

interface DoctorModulePageProps {
  params: Promise<{
    module: string;
  }>;
}

export default async function DoctorModulePage({ params }: DoctorModulePageProps) {
  const { module } = await params;
  const activeModule: CrmModuleKey = isCrmModule(module) ? module : "assigned-population";
  return <CrmWorkspace module={activeModule} />;
}
