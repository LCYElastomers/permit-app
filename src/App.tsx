import { CompositionProvider } from "./components/Composition";
import { Shell } from "./components/Shell";
import { DeviceProvider } from "./services/device";
import { IdentityProvider } from "./services/identity";
import { PermitProvider } from "./state/PermitStore";

export default function App() {
  return (
    <PermitProvider>
      <DeviceProvider>
        <IdentityProvider>
          <CompositionProvider>
            <Shell />
          </CompositionProvider>
        </IdentityProvider>
      </DeviceProvider>
    </PermitProvider>
  );
}
