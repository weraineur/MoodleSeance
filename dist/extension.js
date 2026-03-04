"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
// Core VS Code API used to register commands and show UI messages.
const vscode = __importStar(require("vscode"));
const state = {
    files: [],
    lastResponse: null
};
// Centralize user notifications so messages are consistent.
function info(message) {
    void vscode.window.showInformationMessage(message);
}
// Retrieve or prompt for the OpenAI API key using VS Code secret storage.
async function getApiKey(context) {
    const existing = await context.secrets.get("moodleSeance.openaiApiKey");
    if (existing)
        return existing;
    const input = await vscode.window.showInputBox({
        prompt: "Entrez votre clé API OpenAI",
        password: true,
        ignoreFocusOut: true
    });
    if (!input)
        return undefined;
    const trimmed = input.trim();
    if (!trimmed)
        return undefined;
    await context.secrets.store("moodleSeance.openaiApiKey", trimmed);
    return trimmed;
}
async function resetApiKey(context) {
    await context.secrets.delete("moodleSeance.openaiApiKey");
}
function getModel() {
    return vscode.workspace
        .getConfiguration("moodleSeance")
        .get("model", "gpt-4.1");
}
function getApiBase() {
    return vscode.workspace
        .getConfiguration("moodleSeance")
        .get("apiBase", "https://api.openai.com/v1");
}
function extractOutputText(data) {
    if (typeof data?.output_text === "string")
        return data.output_text;
    const msg = data?.output?.find((item) => item?.type === "message");
    const part = msg?.content?.find((c) => c?.type === "output_text");
    if (typeof part?.text === "string")
        return part.text;
    return "";
}
function activate(context) {
    // Define the pipeline steps and stub handlers for now.
    const steps = [
        {
            id: "moodleSeance.importDocuments",
            title: "Import Documents",
            handler: async () => {
                const result = await vscode.window.showOpenDialog({
                    canSelectMany: true,
                    canSelectFiles: true,
                    canSelectFolders: false,
                    filters: {
                        Documents: ["doc", "docx", "ppt", "pptx", "pdf", "txt", "xls", "xlsx"]
                    }
                });
                if (!result || result.length === 0) {
                    info("Import annulé : aucun fichier sélectionné.");
                    return;
                }
                state.files = result.map((uri) => uri.fsPath);
                info(`Import réussi : ${state.files.length} fichier(s) sélectionné(s).`);
            }
        },
        {
            id: "moodleSeance.extract",
            title: "Extract Content",
            handler: async () => {
                if (state.files.length === 0) {
                    info("Aucun fichier à extraire. Veuillez importer des documents d'abord.");
                    return;
                }
                info("Extraction simulée : contenu extrait de " + state.files.length + " fichier(s).");
            }
        },
        {
            id: "moodleSeance.confirm",
            title: "Confirm Inputs",
            handler: async () => {
                if (state.files.length === 0) {
                    info("Aucun fichier à confirmer. Veuillez importer et extraire des documents d'abord.");
                    return;
                }
                const preview = state.files.slice(0, 10).join("\n");
                const more = state.files.length > 10 ? `\n... et ${state.files.length - 10} autre(s)` : "";
                const message = `Fichiers importés : \n${preview}${more}\n\n Confirmez-vous ces fichiers pour la génération ?`;
                const choice = await vscode.window.showInformationMessage(message, { modal: true }, "Confirmer");
                if (!choice) {
                    info("Confirmation annulée par l'utilisateur.");
                    return;
                }
                info("Fichiers confirmés pour la génération.");
            }
        },
        {
            id: "moodleSeance.sendToModel",
            title: "Send to Model",
            handler: async () => {
                if (state.files.length === 0) {
                    info("Aucun fichier à envoyer.");
                    return;
                }
                const apiKey = await getApiKey(context);
                if (!apiKey) {
                    info("Clé API manquante.");
                    return;
                }
                const model = getModel();
                const apiBase = getApiBase();
                const inputText = "Tu es un assistant. Voici la liste des fichiers importés :\n" +
                    state.files.join("\n") +
                    "\n\nGénère un plan de séance e-learning en te basant sur ces documents.";
                try {
                    const res = await fetch(`${apiBase}/responses`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${apiKey}`
                        },
                        body: JSON.stringify({
                            model,
                            input: inputText
                        })
                    });
                    if (!res.ok) {
                        const errText = await res.text();
                        info(`Erreur OpenAI: ${res.status} ${res.statusText}`);
                        throw new Error(errText);
                    }
                    const data = await res.json();
                    const output = extractOutputText(data);
                    state.lastResponse = output;
                    info("Réponse reçue.");
                }
                catch (err) {
                    info("Échec de l'appel OpenAI.");
                    console.error(err);
                }
            }
        },
        {
            id: "moodleSeance.resetApiKey",
            title: "Reset API Key",
            handler: async () => {
                const choice = await vscode.window.showInformationMessage("Supprimer la clé API enregistrée ?", { modal: true }, "Supprimer");
                if (!choice)
                    return;
                await resetApiKey(context);
                info("Clé API supprimée. Elle sera redemandée à la prochaine utilisation.");
            }
        },
        {
            id: "moodleSeance.generate",
            title: "Generate Outputs",
            handler: async () => {
                if (!state.lastResponse || state.lastResponse.trim().length === 0) {
                    info("Aucune réponse à générer. Lancez d'abord Moodle: Send.");
                    return;
                }
                // 1) Onglet HTML échappé (webview)
                const panel = vscode.window.createWebviewPanel("moodleSeancePreview", "Moodle — HTML échappé", vscode.ViewColumn.Beside, { enableScripts: false });
                const escaped = state.lastResponse
                    .replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;")
                    .replace(/\n/g, "<br/>");
                const htmlSource = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Moodle — HTML échappé</title>
  <style>
    body { font-family: sans-serif; padding: 24px; line-height: 1.5; }
    .container { max-width: 900px; margin: 0 auto; }
    h1 { font-size: 20px; margin-bottom: 16px; }
    .content { white-space: normal; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Prévisualisation (HTML échappé)</h1>
    <div class="content">${escaped}</div>
  </div>
</body>
</html>`;
                panel.webview.html = htmlSource;
                // 2) Onglet Preview Markdown
                const doc = await vscode.workspace.openTextDocument({
                    content: state.lastResponse,
                    language: "markdown"
                });
                await vscode.window.showTextDocument(doc, { preview: false, viewColumn: vscode.ViewColumn.One, preserveFocus: true });
                await vscode.commands.executeCommand("markdown.showPreviewToSide", doc.uri);
                await vscode.commands.executeCommand("markdown.preview.refresh");
                // 3) Onglet texte avec le code HTML
                const htmlDoc = await vscode.workspace.openTextDocument({
                    content: htmlSource,
                    language: "html"
                });
                await vscode.window.showTextDocument(htmlDoc, { preview: false, viewColumn: vscode.ViewColumn.Three, preserveFocus: true });
                info("HTML échappé + preview Markdown + code HTML ouverts.");
            }
        },
        {
            id: "moodleSeance.export",
            title: "Export Outputs",
            handler: async () => {
                if (!state.lastResponse || state.lastResponse.trim().length === 0) {
                    info("Aucune réponse à exporter. Lancez d'abord Moodle: Send.");
                    return;
                }
                const target = await vscode.window.showSaveDialog({
                    saveLabel: "Exporter la séance générée",
                    filters: {
                        "Fichiers texte": ["txt"],
                        "Fichiers HTML": ["html"]
                    },
                    defaultUri: vscode.Uri.file(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
                        ? `${vscode.workspace.workspaceFolders[0].uri.fsPath}\\export-moodle-seance.txt`
                        : "export-moodle-seance.txt")
                });
                if (!target) {
                    info("Export annulé.");
                    return;
                }
                const encoder = new TextEncoder();
                const data = encoder.encode(state.lastResponse);
                await vscode.workspace.fs.writeFile(target, data);
                info(`Export réussi : ${target.fsPath}`);
            }
        }
    ];
    // Register each command with VS Code.
    for (const step of steps) {
        const command = vscode.commands.registerCommand(step.id, step.handler);
        context.subscriptions.push(command);
    }
}
// Deactivate hook kept for completeness.
function deactivate() { }
//# sourceMappingURL=extension.js.map