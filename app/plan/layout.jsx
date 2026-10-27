import { PlanProvider } from "../../components/PlanProvider";
import PlanShell from "../../components/PlanShell";

export default function PlanLayout({ children }) {
  return (
    <PlanProvider>
      <PlanShell>{children}</PlanShell>
    </PlanProvider>
  );
}
