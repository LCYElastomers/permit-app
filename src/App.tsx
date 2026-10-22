import { Shell } from "./components/Shell";
import { DeviceProvider } from "./services/device";
import { PermitProvider } from "./state/PermitStore";

export default function App() {
  return (
    <PermitProvider>
      <DeviceProvider>
        <Shell />
      </DeviceProvider>
    </PermitProvider>
  );
}
