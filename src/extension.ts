// Core VS Code API used to register commands and show UI messages.
import * as vscode from "vscode";

type SessionState = {
  files: string[];
  lastResponse: string | null;
};

const state: SessionState = {
  files: [],
  lastResponse: null
};

type PipelineStep = {
  id: string;
  title: string;
  handler: () => Promise<void> | void;
};

// Centralize user notifications so messages are consistent.
function info(message: string) {
  void vscode.window.showInformationMessage(message);
}

// Retrieve or prompt for the OpenAI API key using VS Code secret storage.
async function getApiKey(context: vscode.ExtensionContext): Promise<string | undefined> {
  const existing = await context.secrets.get("moodleSeance.openaiApiKey");
  if (existing) return existing;

  const input = await vscode.window.showInputBox({
    prompt: "Entrez votre cle API OpenAI",
    password: true,
    ignoreFocusOut: true
  });

  if (!input) return undefined;
  const trimmed = input.trim();
  if (!trimmed) return undefined;

  await context.secrets.store("moodleSeance.openaiApiKey", trimmed);
  return trimmed;
}

function getModel(): string {
  return vscode.workspace
    .getConfiguration("moodleSeance")
    .get<string>("model", "gpt-4.1");
}

function getApiBase(): string {
  return vscode.workspace
    .getConfiguration("moodleSeance")
    .get<string>("apiBase", "https://api.openai.com/v1");
}

function extractOutputText(data: any): string {
  if (typeof data?.output_text === "string") return data.output_text;

  const msg = data?.output?.find((item: any) => item?.type === "message");
  const part = msg?.content?.find((c: any) => c?.type === "output_text");
  if (typeof part?.text === "string") return part.text;

  return "";
}

export function activate(context: vscode.ExtensionContext) {
  // Define the pipeline steps and stub handlers for now.
  const steps: PipelineStep[] = [
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
          info("Import annule : aucun fichier selectionne.");
          return;
        }

        state.files = result.map((uri) => uri.fsPath);
        info(`Import reussi : ${state.files.length} fichier(s) selectionne(s).`);
      }
    },
    {
      id: "moodleSeance.extract",
      title: "Extract Content",
      handler: async () => {
        if (state.files.length === 0) {
          info("Aucun fichier a extraire. Veuillez importer des documents d'abord.");
          return;
        }
        info("Extraction simulee : contenu extrait de " + state.files.length + " fichier(s).");
      }
    },
    {
      id: "moodleSeance.confirm",
      title: "Confirm Inputs",
      handler: async () => {
        if (state.files.length === 0) {
          info("Aucun fichier a confirmer. Veuillez importer et extraire des documents d'abord.");
          return;
        }
        const preview = state.files.slice(0, 10).join("\n");
        const more = state.files.length > 10 ? `\n...and ${state.files.length - 10} more` : "";
        const message = `Fichiers importes : \n${preview}${more}\n\n Confirmez-vous ces fichiers pour la generation ?`;
        const choice = await vscode.window.showInformationMessage(
          message,
          { modal: true },
          "Confirmer"
        );

        if (!choice) {
          info("Confirmation annulee par l'utilisateur.");
          return;
        }
        info("Fichiers confirmes pour la generation.");
      }
    },
    {
      id: "moodleSeance.sendToModel",
      title: "Send to Model",
      handler: async () => {
        if (state.files.length === 0) {
          info("Aucun fichier a envoyer.");
          return;
        }

        const apiKey = await getApiKey(context);
        if (!apiKey) {
          info("Cle API manquante.");
          return;
        }

        const model = getModel();
        const apiBase = getApiBase();

        const inputText =
          "Tu es un assistant. Voici la liste des fichiers importes:\n" +
          state.files.join("\n") +
          "\n\nGenere un plan de seance e-learning en te basant sur ces documents.";

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
          info("Reponse recue.");
        } catch (err) {
          info("Echec de l'appel OpenAI.");
          console.error(err);
        }
      }
    },
    {
      id: "moodleSeance.generate",
      title: "Generate Outputs",
      handler: async () => {
        // TODO: build outputs from model response.
        info("Generation step: build the requested artifacts.");
      }
    },
    {
      id: "moodleSeance.export",
      title: "Export Outputs",
      handler: async () => {
        // TODO: write outputs to files or workspace.
        info("Export step: save outputs to disk.");
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
export function deactivate() {}
