# OpenAI / ChatGPT path

OpenAI's current official docs describe ChatGPT apps as being built with the Apps SDK.
The Apps SDK preview is built on the Model Context Protocol (MCP), and developers test
their apps in ChatGPT Developer Mode.

Relevant official source:

- [Introducing apps in ChatGPT and the new Apps SDK](https://openai.com/index/introducing-apps-in-chatgpt/)

Practical interpretation for this repo:

- This repo's MCP server is the backend/tool layer.
- Claude Desktop can connect to it directly with a local MCP config.
- For OpenAI/ChatGPT, the matching product path is an Apps SDK app that uses MCP as
  its protocol layer, rather than a plain local desktop connector.
