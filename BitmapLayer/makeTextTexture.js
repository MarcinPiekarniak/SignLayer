/* global document */
import {Texture2D} from 'luma.gl';

const GL_TEXTURE_WRAP_S = 0x2802;
const GL_TEXTURE_WRAP_T = 0x2803;
const GL_CLAMP_TO_EDGE = 0x812f;
const MAX_CANVAS_WIDTH = 2048;
const BASELINE_SCALE = 0.9;
const HEIGHT_SCALE = 1.2;
const DEFAULT_PADDING = 4;
const DEFAULT_FONT_FAMILY = 'sans-serif';

function setTextStyle(ctx, fontFamily, fontSize, fontColor) {
  ctx.font = `${fontSize}px ${fontFamily}`;
  ctx.fillStyle = fontColor;
  ctx.strokeStyle = fontColor;
  ctx.textBaseline = 'baseline';
  ctx.textAlign = 'left';
}

export function makeTextTexture(
  gl,
  texts,
) {
  const fontFamily = DEFAULT_FONT_FAMILY;
  const numberOfTexts = texts.length;
  const maxTextLength = Math.max(...texts.map(text => text.text.length));

  // divide canvas size by how much texts there are/letters and square it for fontSize (less letters better quality)
  // 0.7 empir
  const fontSize = Math.floor(0.5 * Math.sqrt(MAX_CANVAS_WIDTH * MAX_CANVAS_WIDTH / (numberOfTexts * maxTextLength)));
  let padding = DEFAULT_PADDING;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  // measure texts
  let row = 0;
  let x = 0;
  // TODO - use Advanced text metrics when they are adopted:
  // https://developer.mozilla.org/en-US/docs/Web/API/TextMetrics
  const fontHeight = fontSize * HEIGHT_SCALE;
  setTextStyle(ctx, fontFamily, fontSize);
  const textMapping = [];
  texts.forEach(({text}) => {
    const mapping = [];

    let pixelBonusX = 0;
    let xStart = x;
    Array.from(text).forEach(char => {
      const {width} = ctx.measureText(char);
      if (text.length === 1) {
        pixelBonusX = width/2;
      }
      mapping.push({
        x: x + pixelBonusX + padding,
        y: row * (fontHeight + padding),
      });
      x += width + padding * 2 + pixelBonusX * 2;
    });

    textMapping.push({
      x: xStart,
      y: row * (fontHeight + padding),
      width: x - xStart,
      height: fontHeight,
      mapping: mapping,
      text: text,
    });

    if (x + fontSize * 3 >= MAX_CANVAS_WIDTH) {
      x = 0;
      row += 1;
    }
  });
  canvas.width = MAX_CANVAS_WIDTH;
  canvas.height = MAX_CANVAS_WIDTH;
  for (let i = 0; i < texts.length; ++i) {
    for (let j = 0; j < texts[i].text.length; ++j) {
      setTextStyle(ctx, fontFamily, fontSize, texts[i].fontColor);
      ctx.fillText(texts[i].text[j], textMapping[i].mapping[j].x, textMapping[i].mapping[j].y + fontSize * BASELINE_SCALE);
    }
  }
  const texture = new Texture2D(gl, {
    pixels: canvas,
    // padding is added only between the characters but not for borders
    // enforce CLAMP_TO_EDGE to avoid any artifacts.
    parameters: {
      [GL_TEXTURE_WRAP_S]: GL_CLAMP_TO_EDGE,
      [GL_TEXTURE_WRAP_T]: GL_CLAMP_TO_EDGE
    }
  });
  return {
    texture,
    mapping: textMapping,
  }
}
