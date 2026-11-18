(function () {
  const params = new URLSearchParams(location.search);
  const gamePath = params.get("game") || "/examples/hello-game/index.html";
  const frame = document.getElementById("game");
  const device = document.getElementById("device");
  const sizeEl = document.getElementById("size");
  const logEl = document.getElementById("log");
  const configEl = document.getElementById("configuration");
  const studentIdEl = document.getElementById("student-id");
  const hostOrigin = location.origin;

  let helloSeen = false;
  let preset = "desktop";
  let orientation = "landscape";
  let manifest = null;
  let activeStudentId = "mock-student-001";

  const presets = {
    desktop: [1280, 720],
    tablet: [1024, 768],
    mobile: [390, 844],
  };

  function log(label, obj) {
    const line = `[${new Date().toLocaleTimeString()}] ${label}\n${obj ? JSON.stringify(obj, null, 2) : ""}\n\n`;
    logEl.textContent += line;
    logEl.scrollTop = logEl.scrollHeight;
  }

  function applyViewport() {
    let [w, h] = presets[preset];
    const nativePortrait = h >= w;
    if ((orientation === "portrait") !== nativePortrait) [w, h] = [h, w];
    const stage = document.querySelector(".stage");
    const maxW = Math.max(260, stage.clientWidth - 32);
    const maxH = Math.max(320, window.innerHeight * 0.68);
    const scale = Math.min(1, maxW / w, maxH / h);
    device.style.width = `${w * scale}px`;
    device.style.height = `${h * scale}px`;
    sizeEl.textContent = `${w} × ${h} (escala ${Math.round(scale * 100)}%)`;
    document.querySelectorAll("[data-preset]").forEach((button) => {
      button.classList.toggle("active", button.dataset.preset === preset);
    });
    document
      .getElementById("portrait")
      .classList.toggle("active", orientation === "portrait");
    document
      .getElementById("landscape")
      .classList.toggle("active", orientation === "landscape");
  }

  function optionValue(option) {
    return option && typeof option === "object" ? option.value : option;
  }

  function optionLabel(option) {
    return option && typeof option === "object" ? option.label : String(option);
  }

  function createFieldControl(field, initialValue) {
    let input;

    if (field.type === "select") {
      input = document.createElement("select");
      (field.options || []).forEach((option) => {
        const element = document.createElement("option");
        element.value = String(optionValue(option));
        element.textContent = optionLabel(option);
        if (
          String(optionValue(option)) ===
          String(initialValue ?? field.default ?? "")
        ) {
          element.selected = true;
        }
        input.appendChild(element);
      });
    } else if (field.type === "boolean") {
      input = document.createElement("input");
      input.type = "checkbox";
      input.checked = initialValue ?? field.default === true;
    } else {
      input = document.createElement("input");
      input.type = field.type === "number" ? "number" : "text";
      const value = initialValue ?? field.default;
      if (value !== undefined && value !== null) input.value = value;
      if (field.min !== undefined) input.min = field.min;
      if (field.max !== undefined) input.max = field.max;
      if (field.step !== undefined) input.step = field.step;
    }

    return input;
  }

  function appendHelp(parent, help) {
    if (!help) return;
    const element = document.createElement("small");
    element.className = "config-help";
    element.textContent = help;
    parent.appendChild(element);
  }

  function readControlValue(input, field) {
    if (field.type === "boolean") return input.checked;
    if (field.type === "number") {
      if (input.value.trim() === "") return undefined;
      return Number(input.value);
    }
    return input.value;
  }

  function renderRepeater(key, field) {
    const section = document.createElement("section");
    section.className = "config-repeater";
    section.dataset.configKey = key;
    section.dataset.configType = "repeater";

    const heading = document.createElement("div");
    heading.className = "repeater-heading";
    const title = document.createElement("strong");
    title.textContent = field.label || key;
    heading.appendChild(title);
    section.appendChild(heading);

    const items = document.createElement("div");
    items.className = "repeater-items";
    section.appendChild(items);

    function addItem(values = {}) {
      const currentCount = items.children.length;
      const maxItems = field.maxItems ?? 100;
      if (currentCount >= maxItems) return;

      const item = document.createElement("fieldset");
      item.className = "repeater-item";
      const legend = document.createElement("legend");
      legend.textContent = `${field.itemLabel || "Item"} ${currentCount + 1}`;
      item.appendChild(legend);

      Object.entries(field.fields || {}).forEach(([fieldName, childField]) => {
        const row = document.createElement("label");
        row.className = "config-row repeater-field";
        const label = document.createElement("span");
        label.textContent = childField.label || fieldName;
        row.appendChild(label);

        const input = createFieldControl(childField, values[fieldName]);
        input.dataset.repeaterField = fieldName;
        input.dataset.repeaterFieldType = childField.type;
        row.appendChild(input);
        appendHelp(row, childField.help);
        item.appendChild(row);
      });

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "repeater-remove";
      remove.textContent = "Remover etapa";
      remove.disabled = items.children.length < (field.minItems ?? 0) + 1;
      remove.addEventListener("click", () => {
        item.remove();
        refreshItems();
      });
      item.appendChild(remove);
      items.appendChild(item);
      refreshItems();
    }

    function refreshItems() {
      const count = items.children.length;
      Array.from(items.children).forEach((item, index) => {
        item.querySelector("legend").textContent =
          `${field.itemLabel || "Item"} ${index + 1}`;
        const remove = item.querySelector(".repeater-remove");
        remove.disabled = count <= (field.minItems ?? 0);
      });
      addButton.disabled = count >= (field.maxItems ?? 100);
    }

    const addButton = document.createElement("button");
    addButton.type = "button";
    addButton.className = "repeater-add";
    addButton.textContent = field.addLabel || "Adicionar item";
    addButton.addEventListener("click", () => addItem());
    section.appendChild(addButton);
    appendHelp(section, field.help);

    const minItems = field.minItems ?? 0;
    for (let i = 0; i < minItems; i += 1) addItem();
    refreshItems();
    return section;
  }

  function renderConfiguration() {
    configEl.innerHTML = "";
    const configuration = (manifest && manifest.configuration) || {};
    if (!Object.keys(configuration).length) {
      configEl.textContent = "Este jogo não declara configurações.";
      return;
    }

    Object.entries(configuration).forEach(([key, field]) => {
      if (field.type === "repeater") {
        configEl.appendChild(renderRepeater(key, field));
        return;
      }

      const row = document.createElement("label");
      row.className = "config-row";
      const title = document.createElement("span");
      title.textContent = field.label || key;
      row.appendChild(title);
      const input = createFieldControl(field);
      input.dataset.configKey = key;
      input.dataset.configType = field.type;
      row.appendChild(input);
      appendHelp(row, field.help);
      configEl.appendChild(row);
    });
  }

  function currentConfiguration() {
    const output = {};

    configEl.querySelectorAll("[data-config-key]").forEach((element) => {
      const key = element.dataset.configKey;
      const type = element.dataset.configType;

      if (type === "repeater") {
        output[key] = Array.from(
          element.querySelectorAll(":scope .repeater-item"),
        ).map((item) => {
          const values = {};
          item.querySelectorAll("[data-repeater-field]").forEach((input) => {
            const fieldName = input.dataset.repeaterField;
            const fieldType = input.dataset.repeaterFieldType;
            const value = readControlValue(input, { type: fieldType });
            if (value !== undefined && value !== "") values[fieldName] = value;
          });
          return values;
        });
        return;
      }

      output[key] = readControlValue(element, { type });
    });

    return output;
  }

  function currentStudentId() {
    return studentIdEl.value.trim();
  }

  async function loadManifest() {
    try {
      const url = new URL("manifest.json", gameUrl);
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      manifest = await response.json();
      renderConfiguration();
      log("HOST: MANIFEST", {
        gameId: manifest.id,
        configuration: manifest.configuration || {},
      });
    } catch (error) {
      configEl.textContent =
        "Não foi possível carregar manifest.json automaticamente.";
      log("HOST: MANIFEST ERROR", { message: error.message });
    }
  }

  document.querySelectorAll("[data-preset]").forEach((button) => {
    button.onclick = () => {
      preset = button.dataset.preset;
      orientation = preset === "mobile" ? "portrait" : "landscape";
      applyViewport();
    };
  });
  document.getElementById("portrait").onclick = () => {
    orientation = "portrait";
    applyViewport();
  };
  document.getElementById("landscape").onclick = () => {
    orientation = "landscape";
    applyViewport();
  };
  window.addEventListener("resize", applyViewport);
  applyViewport();

  const gameUrl = new URL(gamePath, location.href);
  gameUrl.searchParams.set("fctool_origin", hostOrigin);
  loadManifest().then(() =>
    log("HOST", { ready: "configure os valores e inicie a sessão" }),
  );

  document.getElementById("launch").onclick = () => {
    const studentId = currentStudentId();
    if (!studentId) {
      studentIdEl.setCustomValidity("Informe o ID do aluno.");
      studentIdEl.reportValidity();
      return;
    }
    studentIdEl.setCustomValidity("");
    activeStudentId = studentId;
    helloSeen = false;
    frame.src = "about:blank";
    setTimeout(() => {
      frame.src = gameUrl.toString();
      log("HOST: NOVA SESSÃO", {
        loading: frame.src,
        studentId: activeStudentId,
        configuration: currentConfiguration(),
        viewport: { preset, orientation },
      });
    }, 30);
  };

  studentIdEl.addEventListener("input", () =>
    studentIdEl.setCustomValidity(""),
  );

  window.addEventListener("message", (event) => {
    if (event.source !== frame.contentWindow) return;
    if (event.origin !== gameUrl.origin) {
      log("REJEITADO: origin", { origin: event.origin });
      return;
    }
    const message = event.data;
    if (
      !message ||
      message.namespace !== "fctool.game" ||
      message.protocolVersion !== "1.0"
    )
      return;

    log(`GAME -> HOST: ${message.type}`, message);
    if (message.type === "HELLO") {
      helloSeen = true;
      const response = {
        namespace: "fctool.game",
        protocolVersion: "1.0",
        type: "INITIALIZE",
        messageId: `host_${Date.now()}`,
        timestamp: new Date().toISOString(),
        payload: {
          sessionId: "mock-session-001",
          studentId: activeStudentId,
          configuration: currentConfiguration(),
          mode: "mock",
          viewport: { preset, orientation },
        },
      };
      frame.contentWindow.postMessage(response, gameUrl.origin);
      log("HOST -> GAME: INITIALIZE", response);
    }
    if (
      message.type === "READY" &&
      message.payload &&
      message.payload.appliedConfiguration
    ) {
      log(
        "CONFIGURAÇÃO CONFIRMADA PELO JOGO",
        message.payload.appliedConfiguration,
      );
    }
  });

  document.getElementById("clear").onclick = () => {
    logEl.textContent = "";
    if (helloSeen) log("HOST", "log limpo; sessão continua");
  };
})();
