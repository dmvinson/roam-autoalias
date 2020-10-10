const STORAGE_KEY = "roam-autoalias_dictionary";
const TITLE_SELECTOR = ".rm-title-display";
const MAIN_CONTENT_SELECTOR = ".roam-article";
const BLOCK_SELECTOR = ".roam-block";
const BLOCK_TEXTAREA_SELECTOR = ".rm-block-input";
const TYPING_PAUSE_INTERVAL = 2500;
const ALIAS_PAGE_NAME = "roam-autoalias";
const ALIAS_DELIMITER = ",";
const PAGE_NAME_ALIAS_SPLIT_CHAR = ":";
const ALIAS_REGEX = /\[.*?\]\(\[\[.*?\]\]\)/g;
const REFERENCE_REGEX = /\[\[.*?\]\]/g;

function debounce(callback, wait) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(function () {
      callback.apply(this, args);
    }, wait);
  };
}

String.prototype.replaceAll_roamautoalias = function (strReplace, strWith) {
  // See http://stackoverflow.com/a/3561711/556609
  var esc = strReplace.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
  var reg = new RegExp(esc, "ig");
  return this.replace(reg, strWith);
};

function isAlreadyAliased(text, idx) {
  ALIAS_REGEX.lastIndex = 0;
  while ((result = ALIAS_REGEX.exec(text)) !== null) {
    let startIdx = result.index;
    let endIdx = result.index + result[0].length;
    if (startIdx <= idx && idx <= endIdx) {
      return true;
    }
  }
  return false;
}

function isInReference(text, idx) {
  REFERENCE_REGEX.lastIndex = 0;
  while ((result = REFERENCE_REGEX.exec(text)) !== null) {
    let startIdx = result.index;
    let endIdx = result.index + result[0].length;
    if (startIdx <= idx && idx <= endIdx) {
      return true;
    }
  }
  return false;
}

function autoAliasText(text, aliasDict) {
  let currentText = text;
  Object.keys(aliasDict).forEach((k) => {
    let rx = new RegExp(k, "ig");
    while ((match = rx.exec(currentText)) !== null) {
      let replaceIdx = match.index;
      if (
        isAlreadyAliased(currentText, replaceIdx) ||
        isInReference(currentText, replaceIdx)
      ) {
        continue;
      }
      // Check this currentText is not already aliased
      if (
        currentText[replaceIdx - 1] == "[" &&
        currentText[replaceIdx + k.length] == "]"
      ) {
        continue;
      }
      if (
        isAlpha(currentText[replaceIdx - 1]) ||
        isAlpha(currentText[replaceIdx + k.length] || "")
      ) {
        continue;
      }
      let pageName = aliasDict[k];
      let alias = `[${k}]([[${pageName}]])`;
      currentText =
        currentText.substring(0, replaceIdx) +
        alias +
        currentText.substring(replaceIdx + k.length);
    }
  });
  return currentText;
}

function handleEventByMakeAlias(event, aliasDict) {
  let targetElement = event.target;
  let text = targetElement.value;
  let aliasedText = autoAliasText(text, aliasDict);
  if (aliasedText != text) {
    targetElement.value = aliasedText;
  }
}

function isAlpha(c) {
  if (c === undefined) {
    return false;
  }
  let code = c.charCodeAt(0);
  return (
    (code > 47 && code < 58) || // numeric (0-9)
    (code > 64 && code < 91) || // upper alpha (A-Z)
    (code > 96 && code < 123)
  ); // lower alpha (a-z)
}

function getPageName(text) {
  let start = 0;
  while (text[++start] == "[");
  let end = start;
  while (text[++end] != "]");
  let pageName = text.substring(start, end);
  return pageName;
}

function parseAliases(text) {
  let splitText = text.split(ALIAS_DELIMITER);
  return splitText.map((e) => e.trim()).filter((e) => e);
}

function getAliasesFromBlock(text) {
  if (!text || !text.startsWith("[[")) {
    return {};
  }
  let [pageReferenceStr, aliasesStr] = text.split(PAGE_NAME_ALIAS_SPLIT_CHAR);
  if (pageReferenceStr === undefined || aliasesStr === undefined) {
    return {};
  }
  let pageName = getPageName(pageReferenceStr);
  let aliases = parseAliases(aliasesStr);
  return aliases.reduce((dict, alias) => {
    dict[alias] = pageName;
    return dict;
  }, {});
}

function gatherAllAliases() {
  let aliasDict = {};
  document
    .querySelectorAll(`${BLOCK_SELECTOR}, ${BLOCK_TEXTAREA_SELECTOR}`)
    .forEach((el) => {
      let aliases = getAliasesFromBlock(el.textContent);
      aliasDict = { ...aliasDict, ...aliases };
    });
  return aliasDict;
}

function getStoredDict() {
  let dict;
  const stringifiedData = localStorage.getItem(STORAGE_KEY);
  if (stringifiedData === null) {
    console.log("roam-autoalias failed loading dictionary from storage");
    return;
  }
  return JSON.parse(stringifiedData);
}

function saveAliasDict(d) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
    console.log("Saved dictionary successfully:", JSON.stringify(d));
  } catch (e) {
    console.log("Got exception", e, "while saving to roam-autoalias storage");
  }
}

let currentTitle = "";
const observer = new MutationObserver((mutationRecords, observer) => {
  let titleElement = document.querySelector(TITLE_SELECTOR);
  if (titleElement === null) {
    return;
  }
  let newTitle = titleElement.textContent;

  if (currentTitle === newTitle) {
    return;
  } else if (newTitle === ALIAS_PAGE_NAME && currentTitle !== ALIAS_PAGE_NAME) {
    document.querySelector(MAIN_CONTENT_SELECTOR).addEventListener(
      "keyup",
      debounce(() => {
        if (currentTitle === ALIAS_PAGE_NAME) {
          let newAliasDict = gatherAllAliases();
          saveAliasDict(newAliasDict);
          aliasDict = newAliasDict;
        }
      }, 1000)
    );
  } else {
    let aliasDict = getStoredDict();
    if (aliasDict) {
      document.querySelector(MAIN_CONTENT_SELECTOR).addEventListener(
        "keyup",
        debounce((event) => {
          handleEventByMakeAlias(event, aliasDict);
        }, 500)
      );
      document
        .querySelector(MAIN_CONTENT_SELECTOR)
        .addEventListener("keydown", (event) => {
          if (event.which == 13) {
            handleEventByMakeAlias(event, aliasDict);
          }
        });
    }
  }
  currentTitle = newTitle;
}).observe(document.documentElement, { childList: true, subtree: true });
