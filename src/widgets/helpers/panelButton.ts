// Copyright 2024 Glen Reesor
//
// This file is part of HammerBar.
//
// HammerBar is free software: you can redistribute it and/or
// modify it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or (at your
// option) any later version.
//
// HammerBar is distributed in the hope that it will be useful, but
// WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
// FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
// details.
//
// You should have received a copy of the GNU General Public License along with
// HammerBar. If not, see <https://www.gnu.org/licenses/>.

import type { WidgetBuilderParams } from 'src/Panel';

type ImageInfo = { bundleId: string; imagePath?: undefined } |
  { bundleId?: undefined; imagePath: string };

export function getPanelButton(
  {
    x,
    y,
    height,
    panelColor,
    panelHoverColor,
    imageInfo,
    onClick, }: WidgetBuilderParams & { imageInfo: ImageInfo, onClick: () => void }
) {
  function destroy() {
    canvas.delete();
  }

  const mouseCallback: hs.CanvasMouseCallbackType = function(
    this: void,
    _canvas: hs.CanvasType,
    msg: 'mouseEnter' | 'mouseExit' | 'mouseDown' | 'mouseUp',
  ) {
    if (msg === 'mouseEnter') {
      state.mouseIsInsideButton = true;
      render();
    } else if (msg === 'mouseExit') {
      state.mouseIsInsideButton = false;
      state.mouseButtonIsDown = false;
      render();
    } else if (msg === 'mouseDown') {
      state.mouseButtonIsDown = true;
      render();
    } else if (msg === 'mouseUp') {
      state.mouseButtonIsDown = false;
      render();
      onClick();
    }
  }

  function render() {
    const IMAGE_PADDING = 2;
    const normalImageWidth = width - 2 * IMAGE_PADDING;

    const image = imageInfo.bundleId !== undefined
      ? hs.image.imageFromAppBundle(imageInfo.bundleId)
      : hs.image.imageFromPath(imageInfo.imagePath);

    const bgColor = state.mouseIsInsideButton
      ? panelHoverColor
      : panelColor;

    const imageWidth = state.mouseButtonIsDown
      ? 0.8 * normalImageWidth
      : normalImageWidth;

    const imageX = state.mouseButtonIsDown
      ? IMAGE_PADDING + 0.1 * normalImageWidth
      : IMAGE_PADDING;

    canvas.replaceElements(
      [
        {
          type: 'rectangle',
          fillColor: bgColor,
          strokeColor: bgColor,
          frame: {
            x: 0,
            y: 0,
            w: height,
            h: height,
          },
          trackMouseEnterExit: true,
          trackMouseDown: true,
          trackMouseUp: true,
        },
        {
          type: 'image',
          frame: {
            x: imageX,
            y: (height - imageWidth) / 2,
            w: imageWidth,
            h: imageWidth,
          },
          image,
          trackMouseEnterExit: true,
          trackMouseDown: true,
          trackMouseUp: true,
        },
      ]
    );
  }

  const state = {
    mouseButtonIsDown: false,
    mouseIsInsideButton: false,
  };

  const width = height;
  const canvas = hs.canvas.new({ x, y, w: width, h: height });

  render();
  canvas.mouseCallback(mouseCallback);
  canvas.show();

  return {
    bringToFront: () => canvas.show(),
    destroy,
    hide: () => canvas.hide(),
    show: () => canvas.show(),
  };
}
