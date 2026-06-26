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
