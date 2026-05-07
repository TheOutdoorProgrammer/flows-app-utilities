import { AppBlock, events } from "@slflows/sdk/v1";
import { unzipSync } from "fflate";

const unzipUrl: AppBlock = {
  name: "Unzip URL",
  category: "Transform",
  description:
    "Downloads a zip file from a URL and extracts text file contents. Useful for GitHub Actions artifacts and other zip-served content.",
  config: {},
  inputs: {
    default: {
      name: "Zip Download",
      description: "URL and auth details for the zip file to download",
      config: {
        url: {
          name: "URL",
          description: "URL of the zip file to download",
          type: "string",
          required: true,
        },
        authHeader: {
          name: "Authorization Header",
          description:
            'Authorization header value (e.g. "Bearer ghp_xxx" or "token ghp_xxx")',
          type: "string",
          required: false,
          sensitive: true,
        },
        filenameFilter: {
          name: "Filename Filter",
          description:
            "Only extract files matching this substring (e.g. '.md'). Leave empty to extract all text files.",
          type: "string",
          required: false,
        },
      },
      onEvent: async (input) => {
        const { url, authHeader, filenameFilter } = input.event.inputConfig;

        const headers: Record<string, string> = {
          Accept: "application/octet-stream",
        };
        if (authHeader) {
          headers["Authorization"] = authHeader;
        }

        const response = await fetch(url, {
          headers,
          redirect: "follow",
        });

        if (!response.ok) {
          throw new Error(
            `Failed to download zip: ${response.status} ${response.statusText}`,
          );
        }

        const arrayBuffer = await response.arrayBuffer();
        const zipData = new Uint8Array(arrayBuffer);

        const extracted = unzipSync(zipData);

        const files: Array<{ filename: string; content: string }> = [];

        for (const [filename, data] of Object.entries(extracted)) {
          // Skip directories
          if (filename.endsWith("/")) continue;

          // Apply filename filter if provided
          if (filenameFilter && !filename.includes(filenameFilter)) continue;

          // Decode as UTF-8 text
          const content = new TextDecoder().decode(data);
          files.push({ filename, content });
        }

        await events.emit(
          {
            fileCount: files.length,
            files,
          },
          {
            outputKey: "default",
            parentEventId: input.event.id,
          },
        );
      },
    },
  },
  outputs: {
    default: {
      default: true,
      name: "Extracted Files",
      description: "Text contents of extracted files from the zip",
      possiblePrimaryParents: ["default"],
      type: {
        type: "object",
        properties: {
          fileCount: {
            type: "number",
            description: "Number of files extracted",
          },
          files: {
            type: "array",
            description: "Extracted file contents",
            items: {
              type: "object",
              properties: {
                filename: {
                  type: "string",
                  description: "Name of the file within the zip",
                },
                content: {
                  type: "string",
                  description: "Text content of the file",
                },
              },
              required: ["filename", "content"],
            },
          },
        },
        required: ["fileCount", "files"],
      },
    },
  },
};

export default unzipUrl;
