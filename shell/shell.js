
async function loadShell() {
    const versions = document.getElementById("versions");

    try {
        // Leer configuración de la API
        const configResponse = await fetch("./config.json");

        if (!configResponse.ok) {
            throw new Error("No se pudo cargar config.json");
        }

        const config = await configResponse.json();

        // Leer registro de microfrontends
        const registryResponse = await fetch("./registry.json");

        if (!registryResponse.ok) {
            throw new Error("No se pudo cargar registry.json");
        }

        const registry = await registryResponse.json();

        // Cargar cada microfrontend independientemente
        const results = await Promise.all(
            registry.mfes.map(async (mfe) => {
                const slot = document.getElementById(mfe.slot);

                try {
                    await import(mfe.url);

                    const element = document.createElement(mfe.tag);
                    element.setAttribute("api-url", config.apiUrl);

                    slot.replaceChildren(element);

                    return `${mfe.name}: cargado`;
                } catch (error) {
                    console.error(`Error cargando ${mfe.name}:`, error);

                    slot.textContent =
                        `No se pudo cargar ${mfe.name}. Los demás módulos siguen funcionando.`;

                    return `${mfe.name}: error`;
                }
            })
        );

        versions.textContent = "Versiones: " + results.join(" | ");

    } catch (error) {
        console.error("Error en el Shell:", error);
        versions.textContent = "Error al iniciar el Shell: " + error.message;
    }
}

loadShell();

