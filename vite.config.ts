import { defineConfig, loadEnv } from "vite";
import adapter from "@sveltejs/adapter-auto";
import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), "");

	const PORT = parseInt(env.PORT) || 8578;
	const IP = env.IP || "localhost";

	return {
		plugins: [
			tailwindcss(),
			sveltekit({
				compilerOptions: {

					runes: ({ filename }) =>
						filename.split(/[/\\]/).includes("node_modules") ? undefined : true
				},
				adapter: adapter()
			})
		],
		server: {
			host: IP,
			port: PORT
		},
		preview: {
			host: IP,
			port: PORT
		}
	};
});
