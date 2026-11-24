import { afterEach, describe, expect, it, vi } from "vitest";

type HostEnvelope = {
  namespace: string;
  protocolVersion: string;
  type: string;
  messageId?: string;
  timestamp?: string;
  payload: Record<string, unknown>;
};

const hostContexts = [
  {
    label: "aluna em roteiro e card A",
    studentId: "student-ana",
    scriptId: "script-geography",
    cardId: "card-a",
    sessionId: "session-ana-a",
  },
  {
    label: "aluno diferente no mesmo roteiro e card B",
    studentId: "student-bruno",
    scriptId: "script-geography",
    cardId: "card-b",
    sessionId: "session-bruno-b",
  },
  {
    label: "mesma aluna em outro roteiro e card C",
    studentId: "student-ana",
    scriptId: "script-history",
    cardId: "card-c",
    sessionId: "session-ana-c",
  },
];

let originalParentDescriptor: PropertyDescriptor | undefined;
let hostFrame: HTMLIFrameElement | null = null;

afterEach(() => {
  if (originalParentDescriptor) {
    Object.defineProperty(window, "parent", originalParentDescriptor);
  } else {
    Reflect.deleteProperty(window, "parent");
  }
  originalParentDescriptor = undefined;
  hostFrame?.remove();
  hostFrame = null;
  window.history.replaceState({}, "", "/");
  vi.resetModules();
});

describe("contextos do FCTool Mock Host", () => {
  it.each(hostContexts)("mantém a identidade de $label", async (context) => {
    originalParentDescriptor = Object.getOwnPropertyDescriptor(window, "parent");
    hostFrame = document.createElement("iframe");
    document.body.append(hostFrame);
    const hostWindow = hostFrame.contentWindow;
    if (!hostWindow) throw new Error("Não foi possível criar o host simulado.");

    const hostOrigin = "https://mock-host.example";
    const configuration = {
      progression: "sequence",
      difficulty: "easy",
      caseSelection: "class",
      allowReplaySameCase: "sim",
      rankingEnabled: true,
      sessionContinuity: "sim",
    };
    const outboundMessages: Array<{
      message: HostEnvelope;
      targetOrigin: string;
    }> = [];

    Object.defineProperty(window, "parent", {
      configurable: true,
      value: hostWindow,
    });
    window.history.replaceState(
      {},
      "",
      `/?fctool_origin=${encodeURIComponent(hostOrigin)}`,
    );

    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(hostWindow, "postMessage").mockImplementation((message, targetOrigin) => {
      const envelope = message as HostEnvelope;
      outboundMessages.push({ message: envelope, targetOrigin: String(targetOrigin) });

      if (envelope.type === "HELLO") {
        window.dispatchEvent(new MessageEvent("message", {
          source: hostWindow,
          origin: hostOrigin,
          data: {
            namespace: "fctool.game",
            protocolVersion: "1.0",
            type: "INITIALIZE",
            messageId: `host-${context.sessionId}`,
            timestamp: new Date().toISOString(),
            payload: { ...context, configuration },
          },
        }));
      }
    });

    const fctool = await import("./fctool");
    await expect(fctool.initializeFctool()).resolves.toEqual(configuration);

    const identity = fctool.getFctoolIdentity();
    expect(identity).toEqual({
      scriptId: context.scriptId,
      cardId: context.cardId,
      sessionId: context.sessionId,
      playerId: context.studentId,
    });
    expect(fctool.getConfiguredGameConfiguration()).toEqual({
      progression: "sequence",
      difficulty: "facil",
      selection: "class",
      allowReplaySameCase: true,
    });

    fctool.startFctoolGame({
      case_id: 17,
      student_id: identity?.playerId,
      script_id: identity?.scriptId,
      card_id: identity?.cardId,
      session_id: identity?.sessionId,
    });

    const hello = outboundMessages.find(({ message }) => message.type === "HELLO");
    const ready = outboundMessages.find(({ message }) => message.type === "READY");
    const started = outboundMessages.find(({ message }) => message.type === "STARTED");
    expect(hello?.message.payload).toMatchObject({ gameId: "sql-detective" });
    expect(ready?.message.payload.appliedConfiguration).toMatchObject({
      progression: "sequence",
      difficulty: "facil",
      caseSelection: "class",
      allowReplaySameCase: "sim",
      rankingEnabled: "sim",
      sessionContinuity: "sim",
    });
    expect(started?.message.payload).toMatchObject({
      difficulty: "facil",
      case_id: 17,
      student_id: context.studentId,
      script_id: context.scriptId,
      card_id: context.cardId,
      session_id: context.sessionId,
    });
    expect(outboundMessages.every(({ targetOrigin }) => targetOrigin === hostOrigin)).toBe(true);
  });
});
