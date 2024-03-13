import * as vscode from 'vscode';
import * as Path from 'path';
import * as fs from 'fs';

// This class represents the custom editor for log files
class LogViewerProvider implements vscode.CustomReadonlyEditorProvider {
    public static readonly viewType = 'logViewer';

    constructor(private readonly context: vscode.ExtensionContext) { }

    // Called when a custom document is opened. Provides an in-memory representation of the document.
    public async openCustomDocument(uri: vscode.Uri): Promise<vscode.CustomDocument> {
        // In this simple example, we don't need to store document data, so we return a minimal custom document.
        return { uri, dispose: (): void => { } };
    }

    // Called to create the UI of the custom editor, using a webview.
    public async resolveCustomEditor(document: vscode.CustomDocument, webviewPanel: vscode.WebviewPanel): Promise<void> {
        // Read file content
        const content = await vscode.workspace.fs.readFile(document.uri);
        const logText = Buffer.from(content).toString('utf8');

        // Generate HTML for the webview
        const htmlContent = this.generateHtmlContent(logText);
        webviewPanel.webview.options = {
            enableScripts: true,
        };

        (webviewPanel.options as any).enableFindWidget = true;

        (webviewPanel.webview.options as any).enableFindWidget = true;


        webviewPanel.webview.html = htmlContent;

        webviewPanel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'openFile':
                        // Try to construct a path relative to the workspace
                        let fullPath = '';
                        const workspaceRoot = vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].uri.fsPath : null;
                        if (workspaceRoot) {
                            fullPath = Path.join(workspaceRoot, message.filePath);
                        } else {
                            fullPath = message.filePath;
                        }

                        // Check if the file exists in the workspace
                        fs.exists(fullPath, (exists) => {
                            if (!exists && workspaceRoot) {
                                // If the file does not exist relative to the workspace, try the absolute path
                                fullPath = message.filePath;
                            }

                            fs.exists(fullPath, (exists) => {
                                if (exists) {
                                    const fileUri = vscode.Uri.file(fullPath);
                                    // Open the document
                                    vscode.workspace.openTextDocument(fileUri).then(document => {
                                        // Calculate the position to reveal based on message.line and message.column
                                        const line = message.line ? message.line - 1 : 0; // VS Code lines are 0-based
                                        const column = message.column ? message.column - 1 : 0;
                                        const position = new vscode.Position(line, column);

                                        // Display the document in the editor
                                        vscode.window.showTextDocument(document, {
                                            preview: false,
                                            viewColumn: vscode.ViewColumn.One,
                                            selection: new vscode.Range(position, position)
                                        });
                                    });
                                } else {
                                    console.error("File does not exist:", fullPath);
                                }
                            });
                        });
                        break;
                }
            },
        );

    }

    private generateHtmlContent(logText: string): string {
        // Split the log text into lines
        const logLines = logText.split('\n');

        // Start building the HTML content
        let htmlContent = `
            <html>
            <head>
                <style>
                    #filter-toolbar {
                        position: fixed;
                        top: 0;
                        width: 100%;
                        padding: 5px 10px;
                        background-color: #252526; /* VS Code dark theme toolbar color */
                        box-shadow: 0 2px 3px rgba(0,0,0,0.4);
                        display: flex;
                        gap: 5px;
                        height: 25px;
                    }
                    #filter-input {
                        padding: 5px;
                        background-color: #333;
                        border: 1px solid #3c3c3c;
                        border-radius: 4px;
                        color: white;
                        outline: none;
                    }
                    #filter-input::placeholder {
                        color: #bbb;
                    }
                    
                    body { font-family: Consolas, monospace; background-color: #1e1e1e; color: #d4d4d4;
                        padding: 40px 0px 0px 0px;
                    }
                    .log-date { color: #9A9A9A; } /* Lighter grey for less critical info */
                    .log-source { color: #A8A8A8; } /* Light grey for the source, slightly lighter than date */
                    .log-level-silly { color: #FFC0CB; } /* Soft pink, adjust if too bright */
                    .log-level-debug { color: #7B68EE; } /* Medium slate blue, darker than previous */
                    .log-level-trace { color: #3CB371; } /* Medium sea green, darker shade */
                    .log-level-info { color: #1E90FF; } /* Dodger blue for info */
                    .log-level-warn { color: #FFA500; } /* Orange, a bit darker for better contrast */
                    .log-level-error { color: #FF4500; } /* OrangeRed, slightly darker */
                    .log-level-fatal { color: #B22222; } /* Firebrick, dark red for fatal */
                    .log-message { color: #E6E6E6; } /* Slightly off-white for the main message */
                    .log-entry:hover {
                        background-color: #2e2e2e; /* Darker than the body background for subtle highlighting */
                    }
                    .file-link { color: #A8A8A8; } /* Light blue for file links */

                    .log-entry {
                        display: flex;
                        align-items: baseline; /* Aligns items in their baseline for a more uniform look */
                        padding: 3px;
                        gap: 8px; /* Adds some space between the flex items */
                        
                    }
                    
                    .log-date, .log-level-info, .log-level-warn, .log-level-error, .log-level-fatal, .log-level-debug, .log-level-trace, .log-level-silly {
                        white-space: nowrap; /* Prevents these elements from wrapping */
                    }
                    

                    /* Existing styles */

                    .key { color: #9cdcfe; } /* Light blue for JSON keys */
                    .string { color: #ce9178; } /* Light orange for strings */
                    .number { color: #b5cea8; } /* Light green for numbers */
                    .boolean { color: #569cd6; } /* Bold blue for true/false */
                    .null { color: #569cd6; } /* Same bold blue for null */
                
                    .log-message {
                        color: #E6E6E6; /* Slightly off-white for the main message */
                        flex-grow: 1; /* Allows the message to take up the remaining space */
                        overflow-wrap: anywhere; /* Ensures long words are broken and wrapped */
                        // word-wrap: break-word; /* Older browsers */
                    }
                    
                    .log-json {
                        display: inline; /* Allows element to be sized according to its content, up to the max width of its container */
                        max-width: 100%; /* Prevents the element from extending beyond the width of its container */
                    }
                    
                    /* Specific to compact JSON, if needed */
                    .log-json.compact {
                        white-space: normal; /* Allow wrapping in compact mode */
                        max-width: 100%; /* Limit width to prevent overflow */
                    }
                    
                    .log-json.expanded {
                        white-space: pre-wrap; /* Preserve formatting while allowing wrapping in expanded mode */
                    }

                    .expand-toggle {
                        cursor: pointer;
                        background-color: #3c3c3c; /* Match VS Code's dark theme */
                        border: none;
                        border-radius: 4px; /* Optional: rounded corners */
                        transition: background-color 0.2s; /* Smooth background transition */
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        height: 25px;
                        width: 27px;
                        padding: 3px;
                    }
                    
                    .expand-toggle:hover {
                        background-color: #5c5c5c; /* Lighter on hover */
                    }
                    
                    .expand-toggle.expanded {
                        background-color: #007acc; /* Pressed state */
                    }
                    
                    .expand-toggle.expanded .toggle-arrow {
                        transform: rotate(90deg); /* Rotate arrow for expanded state */
                        transform-origin: center; /* Ensure rotation is centered */
                    }
            
                </style>
                <script>

                    function expandLogJson(element) {
                        if (!element.classList.contains('expanded')) {
                            const encodedJson = element.getAttribute('data-json');
                            const json = JSON.parse(decodeURIComponent(encodedJson));

                            element.classList.add('expanded');
                            const expandedHtml = syntaxHighlightJson(JSON.stringify(json, null, 4));
                            element.innerHTML = expandedHtml;
                        } 
                    }

                    function collapseLogJson(element) {
                        if (element.classList.contains('expanded')) {
                            const encodedJson = element.getAttribute('data-json');
                            const json = JSON.parse(decodeURIComponent(encodedJson));

                            element.classList.remove('expanded');
                            const compactJsonHtml = syntaxHighlightJson(JSON.stringify(json)); // Use syntax highlighting
                            element.innerHTML = compactJsonHtml; // Update to maintain styles
                        }
                    }

                    function expandJson(element, force) {
                        if (force == "expand") {
                            expandLogJson(element);
                        } else if (force == "collapse") {
                            collapseLogJson(element);
                        }
                        else { // Toggle
                            if (element.classList.contains('expanded')) {
                                collapseLogJson(element);
                            } else {
                                expandLogJson(element);
                            }
                        }
                    }

                    function ${this.syntaxHighlightJson.toString()}
                </script>
                <script>
                document.addEventListener('DOMContentLoaded', function() {
                    const filterInput = document.getElementById('filter-input');
                    const logsContainer = document.getElementById('logs-container');

                    filterInput.addEventListener('input', function() {
                        const filterValue = filterInput.value.toLowerCase();

                        logsContainer.querySelectorAll('.log-entry').forEach(function(entry) {
                            const logText = entry.textContent.toLowerCase();
                            if (logText.includes(filterValue)) {
                                entry.style.display = ''; // Show log entry
                            } else {
                                entry.style.display = 'none'; // Hide log entry
                            }
                        });
                    });

                    document.getElementById('toggleExpand').addEventListener('click', function() {
                        this.classList.toggle('expanded');
                        // Adjust the logic to expand/collapse all JSON elements based on the expanded state
                        toggleAllJsons(this.classList.contains('expanded'));
                    });
                });

                function toggleAllJsons(expand) {
                    console.log("sdf")
                    const jsonSpans = document.querySelectorAll('.log-json');
                    console.log(jsonSpans);
                    jsonSpans.forEach(span => {
                        if(expand) {
                            // Expand logic here
                            expandJson(span, "expand")
                        } else {
                            // Collapse logic here
                            expandJson(span, "collapse")
                        }
                    });
                }
                </script>
                <script>
                const vscode = acquireVsCodeApi();
                function openFile(filePath, lineNumber, columnNumber) {
                    vscode.postMessage({
                        command: 'openFile',
                        filePath: filePath,
                        line: lineNumber,
                        column: columnNumber
                    });
                }

                </script>

            </head>
            <body>
			<div id="filter-toolbar">
                <input type="text" id="filter-input" placeholder="filter"/>
                
                <button id="toggleExpand" class="expand-toggle">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <path class="toggle-arrow" d="M9 6L15 12L9 18" stroke="#c5c5c5"/>
                    </svg>
                </button>
            </div>
            <div id="logs-container">
        `;

        // Iterate over each log line, parse it, and append it to the HTML content
        logLines.forEach(line => {
            try {
                if (line.trim() === "") {
                    return;

                }
                const logEntry = JSON.parse(line);
                const formattedLine = this.formatLogLine(logEntry);
                htmlContent += `<div class="log-entry">${formattedLine}</div>`;
            } catch (error) {
                // Handle lines that cannot be parsed as JSON
                console.error("Error parsing log line:", error), line;
            }
        });

        // Close the HTML content
        htmlContent += `
            </div>
            </body>
            </html>
        `;

        return htmlContent;
    }

    private isJson(str: string): boolean {
        try {
            JSON.parse(str);
            return true;
        } catch (e) {
            return false;
        }
    }

    private syntaxHighlightJson(jsonString: string): string {
        let formattedJson = jsonString.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return formattedJson.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, (match) => {
            let cls = 'number';
            if (/^"/.test(match)) {
                if (/:$/.test(match)) {
                    cls = 'key'; // Keys
                } else {
                    cls = 'string'; // String values
                }
            } else if (/true|false/.test(match)) {
                cls = 'boolean'; // Booleans
            } else if (/null/.test(match)) {
                cls = 'null'; // null
            }
            // Preserve match exactly as is, including any spaces

            return '<span class="' + cls + '">' + match + '</span>';
        });
    }


    private formatLogLine(logEntry: any): string {
        const date = logEntry.date || '';
        const logLevel = logEntry.logLevel || '';
        const filePath = logEntry.filePath || '';
        const lineNumber = logEntry.lineNumber || '';
        const columnNumber = logEntry.columnNumber || '';
        const functionName = logEntry.functionName || '';
        const argumentsArray = logEntry.argumentsArray || [];

        // Determine the CSS class for the log level
        let logLevelClass = `log-level-${logLevel.toLowerCase()}`;

        // Enhanced JSON processing
        const processedArguments = argumentsArray.map((arg: any) => {
            if (this.isJson(arg)) {
                const json = JSON.parse(arg); // Parse the JSON to an object
                const compactJsonHtml = this.syntaxHighlightJson(JSON.stringify(json)); // Apply highlighting to compact JSON
                console.log("uncomputed", JSON.stringify(json));
                const encodedJson = encodeURIComponent(arg); // Encode original JSON for use in expand/collapse

                // Initially display the compact version with highlighting
                // Store the original JSON in a data attribute for expanding
                return `<span class="log-json compact" data-json="${encodedJson}" onclick="expandJson(this)">${compactJsonHtml}</span>`;
            } else {
                return this.escapeHtml(arg);
            }
        }).join(" ");


        // Create a link for the file path that opens the file when clicked
        // Note: encodeURIComponent is used to ensure the path is a valid URI component

        const lineSuffix = lineNumber !== "" ?
            ":" + lineNumber + (columnNumber !== "" ? ":" + columnNumber : "")
            : "";

        const fileLink = `<a class="file-link" href="#" onclick="openFile('${filePath}', ${lineNumber || 0}, ${columnNumber || 0})">${filePath}${lineSuffix}</a>`;

        return `
            <div class="log-entry">
                <span class="log-date">${this.escapeHtml(date)}</span>
                <span class="${logLevelClass}">${this.escapeHtml(logLevel)}</span>
                <div class="log-message">
                    <span class="log-source">[${fileLink} ${this.escapeHtml(functionName)}]</span>
                    ${processedArguments}
                </div>
            </div>
        `;
    }

    // Utility method to escape HTML special characters to prevent XSS or rendering issues
    private escapeHtml(unsafeText: string): string {
        return unsafeText
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

}

// This is the main activation function of your extension.
export function activate(context: vscode.ExtensionContext) {
    // Register our custom editor provider with VSCode.
    context.subscriptions.push(
        vscode.window.registerCustomEditorProvider(
            LogViewerProvider.viewType,
            new LogViewerProvider(context),
            {
                // Tells VSCode to use the webviewPanel's serializer if available
                webviewOptions: {
                    retainContextWhenHidden: true,
                    enableFindWidget: true,
                },
            }
        )
    );

    // context.subscriptions.push(
    //     vscode.commands.registerCommand('logViewer.openFile', async (filePath, lineNumber) => {
    //         const document = await vscode.workspace.openTextDocument(filePath);
    //         const editor = await vscode.window.showTextDocument(document);
    //         const position = new vscode.Position(lineNumber - 1, 0); // Line numbers are 0-based in VS Code API
    //         editor.selection = new vscode.Selection(position, position);
    //         editor.revealRange(new vscode.Range(position, position));
    //     })
    // );
}

// This function is called when your extension is deactivated
export function deactivate() { }
