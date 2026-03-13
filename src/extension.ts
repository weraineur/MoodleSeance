// Core VS Code API used to register commands and show UI messages.
import * as vscode from "vscode";

type SessionState = {
  files: string[];
  lastResponse: string | null;
  lastGeneratedHtml: string | null;
};

const state: SessionState = {
  files: [],
  lastResponse: null,
  lastGeneratedHtml: null
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
    prompt: "Entrez votre clé API OpenAI",
    password: true,
    ignoreFocusOut: true
  });

  if (!input) return undefined;
  const trimmed = input.trim();
  if (!trimmed) return undefined;

  await context.secrets.store("moodleSeance.openaiApiKey", trimmed);
  return trimmed;
}

async function resetApiKey(context: vscode.ExtensionContext): Promise<void> {
  await context.secrets.delete("moodleSeance.openaiApiKey");
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatInlineMarkdown(value: string): string {
  const escaped = escapeHtml(value);
  return escaped
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>");
}

function renderVideoAccordion(content: string): string {
  return `<div class="accordion" id="accordionExample">
    <div class="card">
        <div class="card-header" id="headingOne">
            <h2 class="mb-0">
                <button class="btn btn-link btn-block text-left" type="button"
                        data-toggle="collapse" data-target="#collapseOne"
                        aria-expanded="true" aria-controls="collapseOne">
                    <div class="p-2 mb-2 bg-info text-white">Vidéo</div>
                </button>
            </h2>
        </div>
        <div id="collapseOne" class="collapse" data-parent="#accordionExample">
            <div class="card-body">${content}</div>
        </div>
    </div>
</div>`;
}

function splitSectionsByTitles(htmlParts: string[]): string[] {
  const sections: string[] = [];
  let current: string[] = [];

  for (const part of htmlParts) {
    if (part.startsWith('<div class="p-2 mb-2 bg-info text-white">') && current.length > 0) {
      sections.push(current.join("\n"));
      current = [part];
      continue;
    }
    current.push(part);
  }

  if (current.length > 0) {
    sections.push(current.join("\n"));
  }
  return sections;
}

function buildTabsContainer(parts: string[]): string {
  const p1 = parts.slice(0, Math.ceil(parts.length / 3)).join("\n");
  const p2 = parts.slice(Math.ceil(parts.length / 3), Math.ceil((2 * parts.length) / 3)).join("\n");
  const p3 = parts.slice(Math.ceil((2 * parts.length) / 3)).join("\n");

  return `<ul class="nav nav-tabs" id="myTab" role="tablist">
  <li class="nav-item">
    <a class="nav-link active" id="naturels-tab" data-toggle="tab" href="#naturels" role="tab">Partie 1</a>
  </li>
  <li class="nav-item">
    <a class="nav-link" id="anthropiques-tab" data-toggle="tab" href="#anthropiques" role="tab">Partie 2</a>
  </li>
  <li class="nav-item">
    <a class="nav-link" id="points-tab" data-toggle="tab" href="#points" role="tab">Partie 3</a>
  </li>
</ul>

<div class="tab-content p-3 border border-top-0" id="myTabContent">

  <div class="tab-pane fade show active" id="naturels" role="tabpanel">
    ${p1}
  </div>

  <div class="tab-pane fade" id="anthropiques" role="tabpanel">
    ${p2}
  </div>

  <div class="tab-pane fade" id="points" role="tabpanel">
    ${p3}
  </div>

</div>`;
}

function renderMoodleHtmlFromMarkdown(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  const htmlParts: string[] = [];
  let inList = false;
  let inTable = false;
  const tableRows: string[] = [];

  const closeList = () => {
    if (inList) {
      htmlParts.push("</ul>");
      inList = false;
    }
  };

  const closeTable = () => {
    if (inTable) {
      htmlParts.push(`<table class="table table-bordered table-striped"><tbody>${tableRows.join("")}</tbody></table>`);
      inTable = false;
      tableRows.length = 0;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      closeList();
      closeTable();
      continue;
    }

    const headingMatch = line.match(/^#{1,6}\s+(.+)$/);
    if (headingMatch) {
      closeList();
      closeTable();
      htmlParts.push(`<div class="p-2 mb-2 bg-info text-white">
    <h3 class="text-white">${formatInlineMarkdown(headingMatch[1])}</h3>
</div>`);
      continue;
    }

    if (line.startsWith("|") && line.endsWith("|")) {
      closeList();
      inTable = true;
      const cols = line
        .split("|")
        .slice(1, -1)
        .map((col) => col.trim());
      if (cols.every((col) => /^:?-{3,}:?$/.test(col))) {
        continue;
      }
      tableRows.push(`<tr>${cols.map((col) => `<td>${formatInlineMarkdown(col)}</td>`).join("")}</tr>`);
      continue;
    }

    const bulletMatch = line.match(/^[-*]\s+(.+)$/);
    if (bulletMatch) {
      closeTable();
      if (!inList) {
        htmlParts.push('<ul class="bullet-list">');
        inList = true;
      }
      htmlParts.push(`<li>${formatInlineMarkdown(bulletMatch[1])}</li>`);
      continue;
    }

    if (/^---+$/.test(line)) {
      closeList();
      closeTable();
      htmlParts.push("<hr>");
      continue;
    }

    closeList();
    closeTable();

    if (/^exemple\s*:/i.test(line)) {
      htmlParts.push(`<div class="alert alert-secondary">
    <strong>Exemple :</strong><br>${formatInlineMarkdown(line.replace(/^exemple\s*:/i, "").trim())}
    </div>`);
      continue;
    }

    if (/vid[eé]o|corrig[ée]/i.test(line)) {
      htmlParts.push(renderVideoAccordion(`<p>${formatInlineMarkdown(line)}</p>`));
      continue;
    }

    htmlParts.push(`<p>${formatInlineMarkdown(line)}</p>`);
  }

  closeList();
  closeTable();

  const sections = splitSectionsByTitles(htmlParts);
  if (sections.length >= 6) {
    return buildTabsContainer(sections);
  }
  return htmlParts.join("\n");
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
        const choice = await vscode.window.showInformationMessage(
          message,
          { modal: true },
          "Confirmer"
        );

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

        const inputText =
          "Tu es un assistant. Voici la liste des fichiers importés :\n" +
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
        } catch (err) {
          info("Échec de l'appel OpenAI.");
          console.error(err);
        }
      }
    },
    {
      id: "moodleSeance.resetApiKey",
      title: "Reset API Key",
      handler: async () => {
        const choice = await vscode.window.showInformationMessage(
          "Supprimer la clé API enregistrée ?",
          { modal: true },
          "Supprimer"
        );
        if (!choice) return;
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
        const panel = vscode.window.createWebviewPanel(
          "moodleSeancePreview",
          "Moodle — HTML échappé",
          vscode.ViewColumn.Beside,
          { enableScripts: false }
        );

        const styledContent = renderMoodleHtmlFromMarkdown(state.lastResponse);

        const htmlSource = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Moodle — HTML pour editeur</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Arial, Helvetica, sans-serif;
      color: #1d2125;
      background: #ffffff;
      line-height: 1.45;
    }
    p {
      margin: 0 0 0.75rem;
      font-size: 1rem;
    }
    .p-2.mb-2.bg-info.text-white {
      background-color: #0d8899 !important;
      color: #fff !important;
    }
    .text-white {
      color: #fff !important;
    }
  </style>
</head>
<body>
  ${styledContent}
</body>
</html>`;
        state.lastGeneratedHtml = htmlSource;
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

        info("HTML Moodle + preview Markdown + code HTML ouverts.");
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

        if (!state.lastGeneratedHtml || state.lastGeneratedHtml.trim().length === 0) {
          info("Aucun HTML généré. Lancez d'abord Moodle: Generate.");
          return;
        }

        const target = await vscode.window.showSaveDialog({
          saveLabel: "Exporter la séance générée",
          filters: {
            "Fichiers texte": ["txt"],
            "Fichiers HTML": ["html"]
          },
          defaultUri: vscode.Uri.file(
            vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
              ? `${vscode.workspace.workspaceFolders[0].uri.fsPath}\\export-moodle-seance.html`
              : "export-moodle-seance.html"
          )
        });

        if (!target) {
          info("Export annulé.");
          return;
        }

        const encoder = new TextEncoder();
        const data = encoder.encode(state.lastGeneratedHtml);
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
export function deactivate() {}
