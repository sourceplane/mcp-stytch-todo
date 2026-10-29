import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import Setup from "./Setup.tsx";

// The app — and with it Stytch's SDK — is imported only once Setup lets it
// render: a page built without a Stytch public token loads no Stytch code and
// calls no Stytch API, it only says how to connect one.
const App = lazy(() => import("./App.tsx"));

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<Setup>
			<Suspense fallback={null}>
				<App />
			</Suspense>
		</Setup>
	</StrictMode>,
);
