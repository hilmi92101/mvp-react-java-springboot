## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `make graph-update` to keep the graph current (AST-only, no API cost).
- Community names are agent-written and are lost when the community count shifts. `make graph-relabel`
  restores them; if the count itself changed, relabel from the members instead. See
  [docs/troubleshooting/graphify-community-labels-reset.md](docs/troubleshooting/graphify-community-labels-reset.md).
- graphify runs on the host, not in a container -- it is the one exception to the Docker-only rule.
  `uv tool install "graphifyy[sql]"`; the `sql` extra is what lets it see the Flyway migrations.
- `graphify-out/` is gitignored: it is derived output and records absolute host paths.
- How this is set up, and how to port it to another project: [docs/architecture/graphify-setup.md](docs/architecture/graphify-setup.md).
