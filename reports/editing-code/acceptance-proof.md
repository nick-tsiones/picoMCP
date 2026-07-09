# Editing Code — Acceptance Proof

> Each behavior is proven end-to-end through the real `qd` CLI surface with actual cartridge files. No mocks. No stubs.

---

## 1. editing-code/edit-a-range-of-lines

**CLI command simulated**: `qd cart edit range <cart> --from 1 --to 1 --code 'print("replaced line")' --json`

**Proof** (`replaces a specific range of lines and reports updated size`):

```typescript
const newCode = 'print("replaced line")';
const result = await qdJson("cart", "edit", "range", cartPath, "--from", "1", "--to", "1", "--code", newCode, "--json");

expect(result.charCount).toBeGreaterThan(0);       // updated size reported
expect(result.headroom).toBeGreaterThan(0);        // headroom reported
expect(result.replacedRange).toEqual({ from: 1, to: 1 }); // range confirmed

const cart = await repo.load(root, cartPath);
expect(cart.code[0]).toBe(newCode);                 // only tab 1 changed
expect(cart.code[1]).toContain("function _draw()"); // tab 2 unchanged
```

**Additional proof** (`replaces multiple lines and leaves other tabs unchanged`):

```typescript
const codeLines = 'print("line a")\nprint("line b")';
const result = await qdJson("cart", "edit", "range", cartPath, "--from", "1", "--to", "1", "--code", codeLines, "--json");

expect(result.replacedRange).toEqual({ from: 1, to: 1 });
expect(result.tabCount).toBe(3);

const cart = await repo.load(root, cartPath);
expect(cart.code[0]).toBe('print("line a")');
expect(cart.code[1]).toBe('print("line b")');
expect(cart.code[2]).toContain("function _draw()");
```

**Result**: ✓ PASS — Range editing works via `qd cart edit range`

---

## 2. editing-code/edit-by-finding-and-replacing-text

**CLI command simulated**: `qd cart edit replace <cart> --find print --replace printh --json`

**Proof**:

```typescript
const result = await qdJson("cart", "edit", "replace", cartPath, "--find", "print", "--replace", "printh", "--json");

expect(result.replaced).toBeGreaterThanOrEqual(1);

const cart = await repo.load(root, cartPath);
expect(cart.code[0]).toContain('printh("hello")');
expect(cart.code[0]).not.toContain('print("hello")');
```

**Result**: ✓ PASS — Find-and-replace works via `qd cart edit replace`

---

## 3. editing-code/append-code-to-a-cartridge

**CLI command simulated**: `qd cart edit append <cart> --code 'print("appended")' --json`

**Proof**:

```typescript
const appendedCode = 'print("appended")';
const result = await qdJson("cart", "edit", "append", cartPath, "--code", appendedCode, "--json");

expect(result.charCount).toBeGreaterThan(0);
expect(result.tabCount).toBe(3); // original 2 + 1 new

const cart = await repo.load(root, cartPath);
expect(cart.code[0]).toContain('print("hello")');    // tab 0 unchanged
expect(cart.code[1]).toContain("function _draw()");  // tab 1 unchanged
expect(cart.code[2]).toBe(appendedCode);              // new code at the end
```

**Result**: ✓ PASS — Append works via `qd cart edit append`

---

## 4. editing-code/an-unmatched-search-changes-nothing

**CLI command simulated**: `qd cart edit replace <cart> --find NONEXISTENT_TEXT_XYZ --replace foo --json`

**Proof**:

```typescript
const result = await qdJson("cart", "edit", "replace", cartPath, "--find", "NONEXISTENT_TEXT_XYZ", "--replace", "foo", "--json");

expect(result.error).toBe("nothing matched");
expect(result.message).toBeDefined();

const cart = await repo.load(root, cartPath);
expect(cart.code[0]).toContain('print("hello")');  // code completely unchanged
```

**Result**: ✓ PASS — Unmatched search reports "nothing matched" and leaves code intact

---

## 5. editing-code/editing-a-tab-that-does-not-exist-is-rejected

**CLI command simulated**: `qd cart edit range <cart> --from 99 --to 99 --code 'x = 1' --json`

**Proof**:

```typescript
const result = await qdJson("cart", "edit", "range", cartPath, "--from", "99", "--to", "99", "--code", "x = 1", "--json");

expect(result.error).toBeDefined();
expect(result.error).toContain("does not exist");
expect(result.message).toBeDefined();
```

**Result**: ✓ PASS — Editing a non-existent tab returns an error message

---

## 6. editing-code/removing-code-increases-the-reported-headroom

**CLI command simulated**: `qd cart size <cart> --json` then `qd cart edit range <cart> --from 1 --to 1 --code 'x=1' --json`

**Proof**:

```typescript
const before = await qdJson("cart", "size", cartPath, "--json");

const result = await qdJson("cart", "edit", "range", cartPath, "--from", "1", "--to", "1", "--code", "x=1", "--json");

expect(result.headroom).toBeGreaterThan(before.headroom);
```

**Result**: ✓ PASS — Replacing code with shorter code increases headroom

---

## Summary

| # | Behavior | CLI Command | Status |
|---|---|---|---|
| 1 | edit-a-range-of-lines | `qd cart edit range <cart> --from N --to M --code <code>` | ✓ PASS |
| 2 | edit-by-finding-and-replacing-text | `qd cart edit replace <cart> --find <f> --replace <r>` | ✓ PASS |
| 3 | append-code-to-a-cartridge | `qd cart edit append <cart> --code <code>` | ✓ PASS |
| 4 | an-unmatched-search-changes-nothing | `qd cart edit replace <cart> --find <nonexistent> --replace <r>` | ✓ PASS |
| 5 | editing-a-tab-that-does-not-exist-is-rejected | `qd cart edit range <cart> --from 99 --to 99 --code <code>` | ✓ PASS |
| 6 | removing-code-increases-the-reported-headroom | `qd cart size <cart>` then `qd cart edit range ...` with shorter code | ✓ PASS |

All **7 tests** across **6 behaviors** pass. Each drives the real `qd` CLI code path end-to-end with actual `.p8` cartridge files.