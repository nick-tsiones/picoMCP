# Security Policy

## Reporting a vulnerability

Report via GitHub Issues with the security label. For sensitive reports, use GitHub's private vulnerability reporting.

## Supported versions

| Version | Supported |
| ------- | --------- |
| 0.1.x   | Yes       |

## Trust model

picoMCP reads and writes PICO-8 cartridge files within the project boundary.
The MCP server exposes filesystem and PICO-8 execution capabilities.
Only expose the MCP server to trusted agents and environments.
