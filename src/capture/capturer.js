// src/capture/capturer.js
'use strict';

/**
 * Capture a PNG buffer of the given screen region using Electron's desktopCapturer.
 *
 * Coordinates are in logical (CSS) pixels — matching what the region selector sends.
 * Note: on HiDPI displays with scaling > 100%, the capture may be slightly offset.
 * This is acceptable for v1; redraw the region if alignment is off.
 *
 * @param {{ x:number, y:number, width:number, height:number }} region
 * @returns {Promise<Buffer>} PNG buffer of the cropped region
 */
async function captureRegion(region) {
  const { desktopCapturer, screen } = require('electron');

  const { width, height } = screen.getPrimaryDisplay().size;

  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width, height },
  });

  if (!sources.length) {
    throw new Error('[capturer] No screen sources found');
  }

  const cropped = sources[0].thumbnail.crop({
    x:      Math.max(0, region.x),
    y:      Math.max(0, region.y),
    width:  region.width,
    height: region.height,
  });

  return cropped.toPNG();
}

module.exports = { captureRegion };
