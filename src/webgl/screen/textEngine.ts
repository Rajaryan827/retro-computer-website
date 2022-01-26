import { Font, FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import * as THREE from "three";

const textColor = "#f99021";

type FontInfo = {
  font: undefined | Font;
  size: number;
  height: number;
  width: number;
  leading: number;
  tracking: number;
};

const titleFont: FontInfo = (function () {
  let size = 0.04;
  let height = size;
  let width = size;
  let leading = height * 2;
  let tracking = width * 0.4;
  return { font: undefined, size, height, width, leading, tracking };
})();

const terminalFont: FontInfo = (function () {
  const size = 0.04;
  const height = size;
  const width = size * 0.8;
  const leading = height * 2;
  const tracking = width * 0.2;
  return { font: undefined, size, height, width, leading, tracking };
})();

const paragraphFont: FontInfo = (function () {
  const size = 0.03;
  const height = size;
  const width = size * 0.8;
  const leading = height * 2.5;
  const tracking = width * 0.2;
  return { font: undefined, size, height, width, leading, tracking };
})();

export function screenTextEngine(
  sceneRTT: THREE.Scene,
  startText: string
): [(deltaTime: number, elapsedTime: number) => void, (key: string) => void] {
  const onFontLoad = () => {
    if (titleFont.font && terminalFont.font && paragraphFont.font) {
      // placeHTML(startText, titleFont);
      placeMarkdown(startText);
    }
  };
  const fontLoader = new FontLoader();
  fontLoader.load("/fonts/public-pixel.json", (font) => {
    titleFont.font = font;
    onFontLoad();
  });
  fontLoader.load("/fonts/chill.json", (font) => {
    terminalFont.font = font;
    paragraphFont.font = font;
    onFontLoad();
  });

  const caret = new THREE.Mesh(
    new THREE.PlaneBufferGeometry(terminalFont.size, terminalFont.size * 1.5),
    new THREE.MeshBasicMaterial({ color: textColor })
  );
  sceneRTT.add(caret);

  let caretTimeSinceUpdate = 1;
  function updateCaret() {
    let x = charNextLoc.x + terminalFont.size / 2;
    let y = -charNextLoc.y - terminalFont.size / 2.66666;
    if (x > 1.396) {
      y -= terminalFont.leading;
      x = terminalFont.size / 2;
    }
    caret.position.set(x, y, 0);
    caretTimeSinceUpdate = 0;
  }

  const chars: { char: THREE.Group; fixed: boolean }[] = [];
  const charNextLoc = {
    x: 0,
    y: 0,
  };

  function placeStr(
    char: string,
    font: FontInfo,
    fixed: boolean,
    highlight: boolean,
    wrap: boolean,
    isWord: boolean
  ) {
    const strLen = (font.width + font.tracking) * char.length;
    const strWrapLen = isWord
      ? (font.width + font.tracking) * (char.length - 1)
      : font.width * char.length;

    let x = charNextLoc.x;
    let y = charNextLoc.y;

    if (wrap && strWrapLen + x > 1.396) {
      y += font.leading;
      x = 0;
    }

    const charObj = new THREE.Group();
    // m.scale.y = height;hh
    charObj.position.x = x;
    charObj.position.y = -y;

    const textGeometry = new TextGeometry(char, {
      font: font.font as any,
      size: font.size,
      height: 0.0001,
      curveSegments: 12,
      bevelEnabled: false,
    });
    const textMaterial = new THREE.MeshBasicMaterial({ color: textColor });
    const text = new THREE.Mesh(textGeometry, textMaterial);
    text.position.set(0, -font.height, -0.01);
    charObj.add(text);

    if (highlight) {
      const background = new THREE.Mesh(
        new THREE.PlaneGeometry(
          strLen + font.tracking * 2,
          font.height + font.leading / 2,
          1,
          1
        ),
        new THREE.MeshBasicMaterial({ color: textColor })
      );

      textMaterial.color.set("black");
      // background.position.x = 0.5;
      background.position.set(
        strLen / 2 - font.tracking / 2,
        -font.height / 2,
        -0.01
      );
      // background.scale.x = 0.05;
      charObj.add(background);
    }

    chars.push({ char: charObj, fixed: fixed });

    sceneRTT.add(charObj);

    charNextLoc.x = strLen + x;
    charNextLoc.y = y;

    updateCaret();

    // return [width + tracking + x, y, charObj];
  }

  function placeLinebreak(font: FontInfo) {
    charNextLoc.x = 0;
    charNextLoc.y += font.leading;
    updateCaret();
  }

  function placeWords(
    words: string[],
    font: FontInfo,
    highlight: boolean = false
  ) {
    for (let word of words) {
      placeStr(word + " ", font, true, highlight, true, true);
    }
  }

  function placeHTML(html: string, font: FontInfo) {
    html = html.replace(/\n/g, "");
    html = html.replace(/\s+/g, " ");
    const text = html.split("<br>");
    console.log(text);

    for (let i = 0; i < text.length; i++) {
      text[i] = text[i].replace(/^\s+|\s+$/g, "");
      console.log(text[i]);
      const words = text[i].split(" ");
      placeWords(words, font);
      if (i < text.length - 1) {
        console.log("<br>");
        placeLinebreak(font);
      }
    }
  }

  type MDtoken = {
    type: "h1" | "h2" | "p" | "br";
    emphasis: boolean;
    value: string;
  };
  function placeMarkdown(md: string) {
    console.log(md.length);
    // md = "## root:~$ curl edwardh.io\n\n\n\n\n\n\n\n#  Hi there,\n#  *I'm Edward*\n#  -Computer Scientist\n#  -Designer\n\n\n\n\n\n\n# root:~$ cd /uni/2019"
    console.log(md.length);

    // md = "## root:~$ curl edwardh.io\n#  Hi there,\n#  *I'm Edward*\n#  -Computer Scientist\n#  -Designer\n# root:~$ cd /uni/2019"

    console.log(md.length);
    const tokens: MDtoken[] = [];

    let currentToken: undefined | MDtoken = undefined;
    for (let i = 0; i < md.length; i++) {
      // h1
      if (currentToken === undefined && md[i] === "#") {
        let type: "h1" | "h2" = "h1";
        if (i + 1 < md.length && md[i + 1] === "#") {
          type = "h2";
          i++;
        }
        if (i + 1 < md.length && md[i + 1] === " ") {
          i++;
        }
        currentToken = {
          type: type,
          emphasis: false,
          value: "",
        };

        // br
      } else if (md[i] === "\n") {
        if (currentToken !== undefined) {
          tokens.push(currentToken);
          currentToken = undefined;
        }
        tokens.push({
          type: "br",
          emphasis: false,
          value: "",
        });

        // p
      } else if (currentToken === undefined) {
        currentToken = {
          type: "p",
          emphasis: false,
          value: md[i],
        };

        // add char to token
      } else {
        currentToken.value += md[i];
      }
    }
    if (currentToken !== undefined) {
      tokens.push(currentToken);
    }
    console.log(tokens);

    for (const t of tokens) {
      console.log(t);
      switch (t.type) {
        case "h1":
          placeStr(t.value, titleFont, true, t.emphasis, false, false);
          break;
        case "h2":
          placeStr(t.value, terminalFont, true, t.emphasis, false, false);
          break;
        case "br":
          placeLinebreak(terminalFont);
          break;
        case "p":
          placeHTML(t.value, paragraphFont)
          break;
      }
    }
  }

  function delChar() {
    const char = chars.pop();
    if (char) {
      if (!char.fixed) {
        sceneRTT.remove(char.char);
        charNextLoc.x = char.char.position.x;
        charNextLoc.y = -char.char.position.y;
      } else chars.push(char);
    }
    updateCaret();
  }

  function userInput(key: string) {
    if (key == "Backspace") {
      delChar();
    } else if (key == "Enter") {
      placeLinebreak(terminalFont);
      placeStr("command not found\n", terminalFont, true, false, true, false);
      placeLinebreak(terminalFont);
      placeLinebreak(terminalFont);
      placeStr("root:~/uni/2019$ ", terminalFont, false, false, true, false);
    } else {
      caret.visible = true;
      // caret.position.x += 0.04;
      placeStr(key, terminalFont, false, false, true, false);
      // caret.position.set(n[0] + 0.02, -n[1] - 0.015, 0);
    }
  }

  function tick(deltaTime: number, elapsedTime: number) {
    if (caretTimeSinceUpdate > 1 && Math.floor(elapsedTime * 2) % 2 == 0) {
      caret.visible = false;
    } else {
      caret.visible = true;
    }

    caretTimeSinceUpdate += deltaTime;
  }

  return [tick, userInput];
}
