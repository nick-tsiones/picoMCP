import { describe, expect, it } from "vite-plus/test";
import { adaptImportSource } from "./index.js";

describe("import adapters", () => {
  it("normalizes roadmap html cards", () => {
    const output = adaptImportSource(
      "roadmap-html",
      `
      <section class="card done ph-baseline">
        <h3>Bootstrap Runtime</h3>
        <span class="ph">baseline</span>
        <p class="goal">Create the runtime shell.</p>
        <ul><li>Runtime starts</li></ul>
      </section>
      <section class="card active">
        <h3>Wire Agent</h3>
        <span class="dep">Bootstrap Runtime</span>
        <p class="goal">Connect the agent.</p>
        <ul><li>Agent responds</li></ul>
      </section>
    `,
    );

    expect(output.nodes.map((node) => [node.id, node.status, node.milestone])).toEqual([
      ["bootstrap-runtime", "done", "baseline"],
      ["wire-agent", "working", undefined],
    ]);
    expect(output.edges).toEqual([
      { from_node: "bootstrap-runtime", to_node: "wire-agent", type: "requires" },
    ]);
    expect(output.nodes[0]).toMatchObject({
      group_name: "baseline",
      acceptance: "Runtime starts",
    });
    expect(output.nodes[1]?.status_reason).toBe("Imported dependencies: Bootstrap Runtime");
  });

  it("uses explicit roadmap ids and maps dependencies through them", () => {
    const output = adaptImportSource(
      "roadmap-html",
      `
      <section>
        <h3 id="runtime-core">Runtime Core</h3>
        <p>Build the core.</p>
      </section>
      <section data-deps="runtime-core">
        <h3 data-qd-id="agent-shell">Agent Shell</h3>
        <p>Build the shell.</p>
      </section>
    `,
    );

    expect(output.nodes.map((node) => node.id)).toEqual(["runtime-core", "agent-shell"]);
    expect(output.edges).toEqual([
      { from_node: "runtime-core", to_node: "agent-shell", type: "requires" },
    ]);
  });

  it("falls back to paragraph text and preserves duplicate roadmap titles with suffixes", () => {
    const output = adaptImportSource(
      "roadmap-html",
      `
      <article class="blocked">
        <h3>Review API &amp; Docs</h3>
        <p>Audit &lt;public&gt; API docs.</p>
      </article>
      <article>
        <h3>Review API &amp; Docs</h3>
        <p>Publish the docs follow-up.</p>
      </article>
    `,
    );

    expect(output.nodes.map((node) => [node.id, node.status, node.spec])).toEqual([
      ["review-api-docs", "blocked", "Audit <public> API docs."],
      ["review-api-docs-2", "ready", "Publish the docs follow-up."],
    ]);
  });

  it("normalizes markdown checklists", () => {
    const output = adaptImportSource(
      "markdown-checklist",
      `
      - [x] Bootstrap Runtime
        - acceptance: Runtime starts
      - [ ] Wire Agent
        - Connect the agent
        - depends on: Bootstrap Runtime
    `,
    );

    expect(output.nodes.map((node) => [node.id, node.status, node.spec])).toEqual([
      ["bootstrap-runtime", "done", "Bootstrap Runtime"],
      ["wire-agent", "ready", "Connect the agent"],
    ]);
    expect(output.edges).toEqual([
      { from_node: "bootstrap-runtime", to_node: "wire-agent", type: "requires" },
    ]);
  });

  it("folds multiple markdown details into a multiline spec", () => {
    const output = adaptImportSource(
      "markdown-checklist",
      `
      - [ ] Wire \`Agent\`
        - Add runtime connection
        - Preserve audit trail
        - done when: Agent responds
    `,
    );

    expect(output.nodes[0]).toMatchObject({
      id: "wire-agent",
      title: "Wire Agent",
      spec: "Add runtime connection\nPreserve audit trail",
      acceptance: "Agent responds",
    });
  });

  it("requires checklist dependency details to be indented under a current node", () => {
    const output = adaptImportSource(
      "markdown-checklist",
      `
      - depends on: Missing Runtime
      - [ ] Wire Agent
        - acceptance: Agent responds
    `,
    );

    expect(output.nodes).toHaveLength(1);
    expect(output.edges).toEqual([]);
  });

  it("fails when roadmap html dependencies reference unknown nodes", () => {
    expect(() =>
      adaptImportSource(
        "roadmap-html",
        `
        <section>
          <h3>Wire Agent</h3>
          <span class="dep">Missing Runtime</span>
          <p class="goal">Connect the agent.</p>
          <ul><li>Agent responds</li></ul>
        </section>
      `,
      ),
    ).toThrow(/unknown node: missing-runtime/);
  });

  it("reads roadmap html data dependencies and statuses without oversized container text", () => {
    const output = adaptImportSource(
      "roadmap-html",
      `
      <section data-status="cancelled">
        <h3>Cancelled Followup</h3>
        <p>Depends on: Alpha Node.</p>
      </section>
      <article aria-label="manual blocker" data-deps="alpha">
        <h3>Blocked Followup</h3>
        <p>Waiting on policy.</p>
      </article>
      <h3 data-qd-id="alpha">Alpha Node</h3>
      <p>No container wrapper.</p>
    `,
    );

    expect(output.nodes.map((node) => [node.id, node.status, node.spec])).toEqual([
      ["cancelled-followup", "cancelled", "Depends on: Alpha Node."],
      ["blocked-followup", "blocked", "Waiting on policy."],
      ["alpha", "ready", "No container wrapper."],
    ]);
    expect(output.edges).toEqual([
      { from_node: "alpha", to_node: "cancelled-followup", type: "requires" },
      { from_node: "alpha", to_node: "blocked-followup", type: "requires" },
    ]);
  });

  it("fails when markdown dependencies reference unknown nodes", () => {
    expect(() =>
      adaptImportSource(
        "markdown-checklist",
        `
        - [ ] Wire Agent
          - depends on: Missing Runtime
      `,
      ),
    ).toThrow(/unknown node: missing-runtime/);
  });

  it("rejects unknown adapters", () => {
    expect(() => adaptImportSource("unknown" as never, "")).toThrow(/Unknown import adapter/);
  });
});
