import { createStytchClient, StytchProvider } from "@stytch/react";
import { Navigate, Route, BrowserRouter as Router, Routes } from "react-router-dom";
import { Authenticate, Authorize, Login, Logout } from "./Auth.tsx";
import { SITE_NAME } from "./site.ts";
import TodoEditor from "./Todos.tsx";

// @stytch/react 20 ships its own client, the type its provider takes
// (upstream builds @stytch/vanilla-js's StytchUIClient, which it does not).
const stytch = createStytchClient(import.meta.env.VITE_STYTCH_PUBLIC_TOKEN ?? "", {
	endpointOptions: {
		testApiDomain: import.meta.env.VITE_STYTCH_DOMAIN,
	},
});

function App() {
	return (
		<StytchProvider stytch={stytch}>
			<main>
				<h1>{SITE_NAME}</h1>
				<Router>
					<Routes>
						<Route path="/oauth/authorize" element={<Authorize />} />
						<Route path="/login" element={<Login />} />
						<Route path="/authenticate" element={<Authenticate />} />
						<Route path="/todoapp" element={<TodoEditor />} />
						<Route path="*" element={<Navigate to="/todoapp" />} />
					</Routes>
				</Router>
			</main>
			<footer>
				<Logout />
			</footer>
		</StytchProvider>
	);
}

export default App;
