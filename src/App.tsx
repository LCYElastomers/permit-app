import { Shell } from "./components/Shell";
import { PermitProvider } from "./state/PermitStore";

export default function App() {
  return (
    <PermitProvider>
      <Shell />
    </PermitProvider>
  );
}
