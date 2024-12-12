import { DiffStrategy } from "../types"

export class SearchReplaceDiffStrategy implements DiffStrategy {
    getToolDescription(cwd: string): string {
        return `## apply_diff
Description: Request to replace existing code using search and replace blocks.
This tool allows for precise, surgical replaces to files by specifying exactly what content to search for and what to replace it with.
Only use this tool when you need to replace/fix existing code.
The tool will maintain proper indentation and formatting while making changes.
Only a single operation is allowed per tool use.
The SEARCH section must exactly match existing content including whitespace and indentation.

Parameters:
- path: (required) The path of the file to modify (relative to the current working directory ${cwd})
- diff: (required) The search/replace blocks defining the changes.

Format:
1. First line must be the file path
2. Followed by search/replace blocks:
    \`\`\`
    <<<<<<< SEARCH
    [exact content to find including whitespace]
    =======
    [new content to replace with]
    >>>>>>> REPLACE
    \`\`\`

Example:

Original file:
\`\`\`
def calculate_total(items):
    total = 0
    for item in items:
        total += item
    return total
\`\`\`

Search/Replace content:
\`\`\`
main.py
<<<<<<< SEARCH
def calculate_total(items):
    total = 0
    for item in items:
        total += item
    return total
=======
def calculate_total(items):
    """Calculate total with 10% markup"""
    return sum(item * 1.1 for item in items)
>>>>>>> REPLACE
\`\`\`

Usage:
<apply_diff>
<path>File path here</path>
<diff>
Your search/replace content here
</diff>
</apply_diff>`
    }

    applyDiff(originalContent: string, diffContent: string): string | false {
        // Extract the search and replace blocks
        const match = diffContent.match(/<<<<<<< SEARCH\n([\s\S]*?)\n=======\n([\s\S]*?)\n>>>>>>> REPLACE/);
        if (!match) {
            return false;
        }

        const [_, searchContent, replaceContent] = match;
        
        // Detect line ending from original content
        const lineEnding = originalContent.includes('\r\n') ? '\r\n' : '\n';
        
        // Split content into lines, handling both \n and \r\n
        const searchLines = searchContent.trim().split(/\r?\n/);
        const replaceLines = replaceContent.trim().split(/\r?\n/);
        const originalLines = originalContent.split(/\r?\n/);
        
        // Find the search content in the original
        let matchIndex = -1;
        
        for (let i = 0; i <= originalLines.length - searchLines.length; i++) {
            let found = true;
            
            for (let j = 0; j < searchLines.length; j++) {
                const originalLine = originalLines[i + j];
                const searchLine = searchLines[j];
                
                // Compare lines after removing leading/trailing whitespace
                if (originalLine.trim() !== searchLine.trim()) {
                    found = false;
                    break;
                }
            }
            
            if (found) {
                matchIndex = i;
                break;
            }
        }
        
        if (matchIndex === -1) {
            return false;
        }
        
        // Get the matched lines from the original content
        const matchedLines = originalLines.slice(matchIndex, matchIndex + searchLines.length);
        
        // Get the exact indentation (preserving tabs/spaces) of each line
        const originalIndents = matchedLines.map(line => {
            const match = line.match(/^[\t ]*/);
            return match ? match[0] : '';
        });
        
        // Get the exact indentation of each line in the search block
        const searchIndents = searchLines.map(line => {
            const match = line.match(/^[\t ]*/);
            return match ? match[0] : '';
        });
        
        // Apply the replacement while preserving exact indentation
        const indentedReplace = replaceLines.map((line, i) => {
            // Get the base original indentation from the first matched line
            const originalIndent = originalIndents[0] || '';
            // Determine the indentation character (tab or space)
            const indentChar = originalIndent.charAt(0) || '\t';
            // Calculate the indentation level of the original line
            const originalLevel = Math.floor(originalIndent.length / indentChar.length);

            // Get the current line's indentation in the replace block
            const currentIndentMatch = line.match(/^[\t ]*/);
            const currentIndent = currentIndentMatch ? currentIndentMatch[0] : '';
            // Calculate the indentation level of the current line
            const currentLevel = Math.floor(currentIndent.length / indentChar.length);

            // Get the corresponding search line's indentation
            const searchLineIndex = Math.min(i, searchLines.length - 1);
            const searchLineIndent = searchIndents[searchLineIndex] || '';
             // Calculate the indentation level of the search line
            const searchLevel = Math.floor(searchLineIndent.length / indentChar.length);

            // Calculate the relative indentation level
            const relativeLevel = currentLevel - searchLevel;
            // Calculate the target indentation level by adding the relative level to the original level
            const targetLevel = Math.max(0, originalLevel + relativeLevel);

            // Apply the calculated indentation to the line
            return indentChar.repeat(targetLevel) + line.trim();
        });
        
        // Construct the final content
        const beforeMatch = originalLines.slice(0, matchIndex);
        const afterMatch = originalLines.slice(matchIndex + searchLines.length);
        
        return [...beforeMatch, ...indentedReplace, ...afterMatch].join(lineEnding);
    }
}
