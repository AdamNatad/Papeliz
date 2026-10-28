#!/usr/bin/env node
// Papeliz image to SVG. The per-OS scripts in build_tools/design/<os>/ call this file:
//   node build_tools/shared/image-to-svg/papeliz-image-to-svg.mjs <picture.png> <output folder> [options]
// It traces a flat, one-color logo or icon picture (a colored mark on a plain background, or on
// transparency) into a real vector: one smooth path of cubic curves, with its holes, placed on the
// 28 x 28 grid of the Papeliz mark. It then writes the Papeliz variants of that path: the blue
// gradient mark, the white mark for the blue topbar, a currentColor mark, and the app tile in both
// tones. Node.js only, no packages.

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { inflateSync } from 'node:zlib'

const papelizImageToSvgUsage = `Papeliz image to SVG

Usage:
  node build_tools/shared/image-to-svg/papeliz-image-to-svg.mjs <picture.png> <output folder> [options]

Options:
  --name <name>             File name prefix (default: the picture's name)
  --padding <units>         Space around the mark on the 28 x 28 grid (default: 2.5)
  --tile-mark-size <units>  Size of the mark inside the app tile (default: 16.5)
  --fit-tolerance <px>      Largest distance, in picture pixels, a curve may stray from the traced
                            outline (default: 0.8; smaller keeps more detail, larger gives fewer curves)
  --corner-angle <degrees>  Turn that counts as a sharp corner (default: 50)
  --min-area <px>           Drop specks smaller than this area, in picture pixels (default: 40)
  --help                    Show this help

Writes, in the output folder:
  <name>-traced-mark-gradient.svg       the mark in the Papeliz blue gradient, for white grounds
  <name>-traced-mark-on-blue.svg        the mark in white, for the blue topbar
  <name>-traced-mark-current-color.svg  the mark in currentColor, colored by the page around it
  <name>-traced-app-tile.svg            the white mark on the blue gradient app tile
  <name>-traced-app-tile-on-blue.svg    the gradient mark on a white app tile, for the blue topbar
`

const papelizMarkGridSize = 28
const papelizGradientStartColor = '#0064D4'
const papelizGradientEndColor = '#5B70FF'
const papelizAppTileCornerRadius = 6

// ---------------------------------------------------------------- arguments

function readImageToSvgArguments(commandLineArguments) {
  const imageToSvgSettings = {
    sourcePicturePath: null,
    outputFolderPath: null,
    outputNamePrefix: null,
    markGridPadding: 2.5,
    appTileMarkSize: 16.5,
    curveFitTolerancePixels: 0.8,
    cornerAngleDegrees: 50,
    minimumOutlineAreaPixels: 40,
    showHelp: false,
  }
  const numericOptionKeys = {
    '--padding': 'markGridPadding',
    '--tile-mark-size': 'appTileMarkSize',
    '--fit-tolerance': 'curveFitTolerancePixels',
    '--corner-angle': 'cornerAngleDegrees',
    '--min-area': 'minimumOutlineAreaPixels',
  }
  const positionalArguments = []
  for (let argumentIndex = 0; argumentIndex < commandLineArguments.length; argumentIndex++) {
    const commandLineArgument = commandLineArguments[argumentIndex]
    if (commandLineArgument === '--help' || commandLineArgument === '-h') {
      imageToSvgSettings.showHelp = true
    } else if (commandLineArgument === '--name') {
      imageToSvgSettings.outputNamePrefix = commandLineArguments[++argumentIndex]
    } else if (numericOptionKeys[commandLineArgument]) {
      const optionValue = Number(commandLineArguments[++argumentIndex])
      if (!Number.isFinite(optionValue)) throw new Error(`${commandLineArgument} needs a number`)
      imageToSvgSettings[numericOptionKeys[commandLineArgument]] = optionValue
    } else if (commandLineArgument.startsWith('--')) {
      throw new Error(`Unknown option ${commandLineArgument}`)
    } else {
      positionalArguments.push(commandLineArgument)
    }
  }
  ;[imageToSvgSettings.sourcePicturePath, imageToSvgSettings.outputFolderPath] = positionalArguments
  if (!imageToSvgSettings.outputNamePrefix && imageToSvgSettings.sourcePicturePath) {
    imageToSvgSettings.outputNamePrefix = path.basename(imageToSvgSettings.sourcePicturePath, path.extname(imageToSvgSettings.sourcePicturePath))
  }
  return imageToSvgSettings
}

// ---------------------------------------------------------------- PNG reading

// Decodes an 8-bit, non-interlaced PNG (gray, gray + alpha, RGB, RGBA or palette) into RGBA bytes.
function decodePngPicture(pngFileBytes) {
  const pngSignatureBytes = [137, 80, 78, 71, 13, 10, 26, 10]
  if (!pngSignatureBytes.every((signatureByte, byteIndex) => pngFileBytes[byteIndex] === signatureByte)) {
    throw new Error('The picture is not a PNG file')
  }
  let chunkOffset = 8
  let pictureWidth = 0
  let pictureHeight = 0
  let bitDepth = 0
  let colorType = 0
  let interlaceMethod = 0
  let paletteBytes = null
  let paletteAlphaBytes = null
  const imageDataChunks = []
  while (chunkOffset < pngFileBytes.length) {
    const chunkLength = pngFileBytes.readUInt32BE(chunkOffset)
    const chunkType = pngFileBytes.toString('latin1', chunkOffset + 4, chunkOffset + 8)
    const chunkData = pngFileBytes.subarray(chunkOffset + 8, chunkOffset + 8 + chunkLength)
    chunkOffset += 12 + chunkLength
    if (chunkType === 'IHDR') {
      pictureWidth = chunkData.readUInt32BE(0)
      pictureHeight = chunkData.readUInt32BE(4)
      bitDepth = chunkData[8]
      colorType = chunkData[9]
      interlaceMethod = chunkData[12]
    } else if (chunkType === 'PLTE') {
      paletteBytes = chunkData
    } else if (chunkType === 'tRNS') {
      paletteAlphaBytes = chunkData
    } else if (chunkType === 'IDAT') {
      imageDataChunks.push(chunkData)
    } else if (chunkType === 'IEND') {
      break
    }
  }
  if (bitDepth !== 8 || interlaceMethod !== 0) {
    throw new Error(`Only 8-bit, non-interlaced PNGs are supported (this one: ${bitDepth}-bit, interlace ${interlaceMethod})`)
  }
  const channelCountByColorType = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }
  const channelCount = channelCountByColorType[colorType]
  if (!channelCount) throw new Error(`Unsupported PNG color type ${colorType}`)

  const filteredRows = inflateSync(Buffer.concat(imageDataChunks))
  const rowByteLength = pictureWidth * channelCount
  const unfilteredBytes = Buffer.alloc(pictureHeight * rowByteLength)
  for (let rowIndex = 0; rowIndex < pictureHeight; rowIndex++) {
    const filterType = filteredRows[rowIndex * (rowByteLength + 1)]
    const filteredRowStart = rowIndex * (rowByteLength + 1) + 1
    const rowStart = rowIndex * rowByteLength
    const previousRowStart = rowStart - rowByteLength
    for (let byteIndex = 0; byteIndex < rowByteLength; byteIndex++) {
      const filteredByte = filteredRows[filteredRowStart + byteIndex]
      const leftByte = byteIndex >= channelCount ? unfilteredBytes[rowStart + byteIndex - channelCount] : 0
      const aboveByte = rowIndex > 0 ? unfilteredBytes[previousRowStart + byteIndex] : 0
      const aboveLeftByte = rowIndex > 0 && byteIndex >= channelCount ? unfilteredBytes[previousRowStart + byteIndex - channelCount] : 0
      let predictorByte = 0
      if (filterType === 1) predictorByte = leftByte
      else if (filterType === 2) predictorByte = aboveByte
      else if (filterType === 3) predictorByte = (leftByte + aboveByte) >> 1
      else if (filterType === 4) {
        const paethEstimate = leftByte + aboveByte - aboveLeftByte
        const leftDistance = Math.abs(paethEstimate - leftByte)
        const aboveDistance = Math.abs(paethEstimate - aboveByte)
        const aboveLeftDistance = Math.abs(paethEstimate - aboveLeftByte)
        predictorByte = leftDistance <= aboveDistance && leftDistance <= aboveLeftDistance
          ? leftByte
          : aboveDistance <= aboveLeftDistance ? aboveByte : aboveLeftByte
      }
      unfilteredBytes[rowStart + byteIndex] = (filteredByte + predictorByte) & 255
    }
  }

  const rgbaBytes = new Uint8ClampedArray(pictureWidth * pictureHeight * 4)
  for (let pixelIndex = 0; pixelIndex < pictureWidth * pictureHeight; pixelIndex++) {
    const sourceOffset = pixelIndex * channelCount
    let red, green, blue, alpha
    if (colorType === 0) [red, green, blue, alpha] = [unfilteredBytes[sourceOffset], unfilteredBytes[sourceOffset], unfilteredBytes[sourceOffset], 255]
    else if (colorType === 4) [red, green, blue, alpha] = [unfilteredBytes[sourceOffset], unfilteredBytes[sourceOffset], unfilteredBytes[sourceOffset], unfilteredBytes[sourceOffset + 1]]
    else if (colorType === 2) [red, green, blue, alpha] = [unfilteredBytes[sourceOffset], unfilteredBytes[sourceOffset + 1], unfilteredBytes[sourceOffset + 2], 255]
    else if (colorType === 6) [red, green, blue, alpha] = unfilteredBytes.subarray(sourceOffset, sourceOffset + 4)
    else {
      const paletteIndex = unfilteredBytes[sourceOffset]
      ;[red, green, blue] = paletteBytes.subarray(paletteIndex * 3, paletteIndex * 3 + 3)
      alpha = paletteAlphaBytes && paletteIndex < paletteAlphaBytes.length ? paletteAlphaBytes[paletteIndex] : 255
    }
    rgbaBytes.set([red, green, blue, alpha], pixelIndex * 4)
  }
  return { pictureWidth, pictureHeight, rgbaBytes }
}

// ---------------------------------------------------------------- ink coverage

// How much of each pixel is the mark, from 0 (background) to about 1 (full ink). With a
// transparent background the alpha is the coverage; otherwise it is the color distance from the
// background (read from the picture's border), scaled so typical full-ink pixels are 1. Edges that
// blend ink into the background land in between, which places the outline between pixels.
function measureInkCoverage({ pictureWidth, pictureHeight, rgbaBytes }) {
  const borderPixelIndexes = []
  for (let x = 0; x < pictureWidth; x++) borderPixelIndexes.push(x, (pictureHeight - 1) * pictureWidth + x)
  for (let y = 1; y < pictureHeight - 1; y++) borderPixelIndexes.push(y * pictureWidth, y * pictureWidth + pictureWidth - 1)
  const medianOfBorderChannel = (channelOffset) => {
    const borderChannelValues = borderPixelIndexes.map((pixelIndex) => rgbaBytes[pixelIndex * 4 + channelOffset]).sort((a, b) => a - b)
    return borderChannelValues[Math.floor(borderChannelValues.length / 2)]
  }
  const inkCoverage = new Float32Array(pictureWidth * pictureHeight)
  const backgroundAlpha = medianOfBorderChannel(3)
  if (backgroundAlpha < 16) {
    for (let pixelIndex = 0; pixelIndex < inkCoverage.length; pixelIndex++) inkCoverage[pixelIndex] = rgbaBytes[pixelIndex * 4 + 3] / 255
    return { inkCoverage, backgroundDescription: 'transparent' }
  }
  const [backgroundRed, backgroundGreen, backgroundBlue] = [0, 1, 2].map(medianOfBorderChannel)
  let largestColorDistance = 0
  for (let pixelIndex = 0; pixelIndex < inkCoverage.length; pixelIndex++) {
    const pixelOffset = pixelIndex * 4
    const pixelAlpha = rgbaBytes[pixelOffset + 3] / 255
    // Composite any transparency over the background first.
    const red = rgbaBytes[pixelOffset] * pixelAlpha + backgroundRed * (1 - pixelAlpha)
    const green = rgbaBytes[pixelOffset + 1] * pixelAlpha + backgroundGreen * (1 - pixelAlpha)
    const blue = rgbaBytes[pixelOffset + 2] * pixelAlpha + backgroundBlue * (1 - pixelAlpha)
    const colorDistance = Math.hypot(red - backgroundRed, green - backgroundGreen, blue - backgroundBlue)
    inkCoverage[pixelIndex] = colorDistance
    if (colorDistance > largestColorDistance) largestColorDistance = colorDistance
  }
  // Full ink: the 90th percentile of clearly inked pixels, so a few extreme pixels do not set the scale.
  const clearlyInkedDistances = []
  for (const colorDistance of inkCoverage) if (colorDistance > largestColorDistance * 0.35) clearlyInkedDistances.push(colorDistance)
  if (clearlyInkedDistances.length === 0) throw new Error('The picture has no mark that stands out from its background')
  clearlyInkedDistances.sort((a, b) => a - b)
  const fullInkDistance = clearlyInkedDistances[Math.floor(clearlyInkedDistances.length * 0.9)]
  for (let pixelIndex = 0; pixelIndex < inkCoverage.length; pixelIndex++) inkCoverage[pixelIndex] /= fullInkDistance
  const backgroundHex = `#${[backgroundRed, backgroundGreen, backgroundBlue].map((channel) => Math.round(channel).toString(16).padStart(2, '0')).join('')}`
  return { inkCoverage, backgroundDescription: backgroundHex }
}

// ---------------------------------------------------------------- outlines (marching squares)

// Finds every closed outline where the coverage crosses one half, between pixel centers, so the
// outline follows the anti-aliased edge instead of the pixel staircase. Returns outlines as point
// lists in picture pixels; outer edges and holes alike (the SVG fills them with the even-odd rule).
function traceInkOutlines(inkCoverage, pictureWidth, pictureHeight, minimumOutlineAreaPixels) {
  const coverageThreshold = 0.5
  const coverageAt = (x, y) => (x < 0 || y < 0 || x >= pictureWidth || y >= pictureHeight ? 0 : inkCoverage[y * pictureWidth + x])
  // Cell-edge ids over a grid padded by one pixel on each side, so every outline closes.
  const paddedColumnCount = pictureWidth + 2
  const horizontalEdgeId = (x, y) => ((y + 1) * paddedColumnCount + (x + 1)) * 2
  const verticalEdgeId = (x, y) => ((y + 1) * paddedColumnCount + (x + 1)) * 2 + 1
  const neighborEdgeIdsByEdgeId = new Map()
  const linkCellEdges = (firstEdgeId, secondEdgeId) => {
    if (!neighborEdgeIdsByEdgeId.has(firstEdgeId)) neighborEdgeIdsByEdgeId.set(firstEdgeId, [])
    if (!neighborEdgeIdsByEdgeId.has(secondEdgeId)) neighborEdgeIdsByEdgeId.set(secondEdgeId, [])
    neighborEdgeIdsByEdgeId.get(firstEdgeId).push(secondEdgeId)
    neighborEdgeIdsByEdgeId.get(secondEdgeId).push(firstEdgeId)
  }
  for (let y = -1; y < pictureHeight; y++) {
    for (let x = -1; x < pictureWidth; x++) {
      const topLeftInked = coverageAt(x, y) >= coverageThreshold
      const topRightInked = coverageAt(x + 1, y) >= coverageThreshold
      const bottomRightInked = coverageAt(x + 1, y + 1) >= coverageThreshold
      const bottomLeftInked = coverageAt(x, y + 1) >= coverageThreshold
      const cellCase = (topLeftInked ? 8 : 0) | (topRightInked ? 4 : 0) | (bottomRightInked ? 2 : 0) | (bottomLeftInked ? 1 : 0)
      if (cellCase === 0 || cellCase === 15) continue
      const topEdge = horizontalEdgeId(x, y)
      const bottomEdge = horizontalEdgeId(x, y + 1)
      const leftEdge = verticalEdgeId(x, y)
      const rightEdge = verticalEdgeId(x + 1, y)
      switch (cellCase) {
        case 1: case 14: linkCellEdges(leftEdge, bottomEdge); break
        case 2: case 13: linkCellEdges(bottomEdge, rightEdge); break
        case 3: case 12: linkCellEdges(leftEdge, rightEdge); break
        case 4: case 11: linkCellEdges(topEdge, rightEdge); break
        case 6: case 9: linkCellEdges(topEdge, bottomEdge); break
        case 7: case 8: linkCellEdges(topEdge, leftEdge); break
        case 5: case 10: {
          // Saddle: the cell's average decides whether the two inked corners join through the middle.
          const cellCenterInked = (coverageAt(x, y) + coverageAt(x + 1, y) + coverageAt(x + 1, y + 1) + coverageAt(x, y + 1)) / 4 >= coverageThreshold
          const topRightCornerIsolated = (cellCase === 5) !== cellCenterInked
          if (topRightCornerIsolated) {
            linkCellEdges(topEdge, rightEdge)
            linkCellEdges(leftEdge, bottomEdge)
          } else {
            linkCellEdges(topEdge, leftEdge)
            linkCellEdges(bottomEdge, rightEdge)
          }
          break
        }
      }
    }
  }

  const outlinePointOfEdge = (edgeId) => {
    const isVerticalEdge = edgeId % 2 === 1
    const paddedCellIndex = Math.floor(edgeId / 2)
    const x = (paddedCellIndex % paddedColumnCount) - 1
    const y = Math.floor(paddedCellIndex / paddedColumnCount) - 1
    const startCoverage = coverageAt(x, y)
    const endCoverage = isVerticalEdge ? coverageAt(x, y + 1) : coverageAt(x + 1, y)
    const crossingFraction = endCoverage === startCoverage ? 0.5 : Math.min(1, Math.max(0, (coverageThreshold - startCoverage) / (endCoverage - startCoverage)))
    return isVerticalEdge ? [x, y + crossingFraction] : [x + crossingFraction, y]
  }

  const inkOutlines = []
  const visitedEdgeIds = new Set()
  for (const startEdgeId of neighborEdgeIdsByEdgeId.keys()) {
    if (visitedEdgeIds.has(startEdgeId)) continue
    const outlineEdgeIds = [startEdgeId]
    visitedEdgeIds.add(startEdgeId)
    let previousEdgeId = startEdgeId
    let currentEdgeId = neighborEdgeIdsByEdgeId.get(startEdgeId)[0]
    while (currentEdgeId !== startEdgeId) {
      outlineEdgeIds.push(currentEdgeId)
      visitedEdgeIds.add(currentEdgeId)
      const [firstNeighborEdgeId, secondNeighborEdgeId] = neighborEdgeIdsByEdgeId.get(currentEdgeId)
      const nextEdgeId = firstNeighborEdgeId === previousEdgeId ? secondNeighborEdgeId : firstNeighborEdgeId
      previousEdgeId = currentEdgeId
      currentEdgeId = nextEdgeId
    }
    const outlinePoints = removeNearDuplicatePoints(outlineEdgeIds.map(outlinePointOfEdge))
    if (outlinePoints.length >= 3 && Math.abs(signedPolygonArea(outlinePoints)) >= minimumOutlineAreaPixels) inkOutlines.push(outlinePoints)
  }
  return inkOutlines
}

function removeNearDuplicatePoints(outlinePoints) {
  const keptPoints = []
  for (const outlinePoint of outlinePoints) {
    const lastKeptPoint = keptPoints[keptPoints.length - 1]
    if (!lastKeptPoint || Math.hypot(outlinePoint[0] - lastKeptPoint[0], outlinePoint[1] - lastKeptPoint[1]) > 0.05) keptPoints.push(outlinePoint)
  }
  const firstPoint = keptPoints[0]
  const lastPoint = keptPoints[keptPoints.length - 1]
  if (keptPoints.length > 1 && Math.hypot(firstPoint[0] - lastPoint[0], firstPoint[1] - lastPoint[1]) <= 0.05) keptPoints.pop()
  return keptPoints
}

function signedPolygonArea(polygonPoints) {
  let doubledArea = 0
  for (let pointIndex = 0; pointIndex < polygonPoints.length; pointIndex++) {
    const [x1, y1] = polygonPoints[pointIndex]
    const [x2, y2] = polygonPoints[(pointIndex + 1) % polygonPoints.length]
    doubledArea += x1 * y2 - x2 * y1
  }
  return doubledArea / 2
}

// ---------------------------------------------------------------- vector helpers

const addVectors = (a, b) => [a[0] + b[0], a[1] + b[1]]
const subtractVectors = (a, b) => [a[0] - b[0], a[1] - b[1]]
const scaleVector = (a, factor) => [a[0] * factor, a[1] * factor]
const dotVectors = (a, b) => a[0] * b[0] + a[1] * b[1]
const vectorLength = (a) => Math.hypot(a[0], a[1])
const normalizeVector = (a) => {
  const length = vectorLength(a)
  return length === 0 ? [0, 0] : [a[0] / length, a[1] / length]
}

// ---------------------------------------------------------------- corners and smoothing

// Index of the point reached after walking at least `walkDistance` along a closed outline.
function walkAlongOutline(outlinePoints, startIndex, walkDirection, walkDistance) {
  let walkedDistance = 0
  let pointIndex = startIndex
  for (let stepCount = 0; stepCount < outlinePoints.length - 1; stepCount++) {
    const nextIndex = (pointIndex + walkDirection + outlinePoints.length) % outlinePoints.length
    walkedDistance += vectorLength(subtractVectors(outlinePoints[nextIndex], outlinePoints[pointIndex]))
    pointIndex = nextIndex
    if (walkedDistance >= walkDistance) break
  }
  return pointIndex
}

// Points where the outline turns sharply over a short distance, kept as corners; rounded turns
// spread over more than a few pixels stay smooth curves.
function findOutlineCornerIndexes(outlinePoints, cornerAngleDegrees) {
  const cornerProbeDistance = 4
  const cornerAngleRadians = (cornerAngleDegrees * Math.PI) / 180
  const turnAngles = outlinePoints.map((outlinePoint, pointIndex) => {
    const behindPoint = outlinePoints[walkAlongOutline(outlinePoints, pointIndex, -1, cornerProbeDistance)]
    const aheadPoint = outlinePoints[walkAlongOutline(outlinePoints, pointIndex, 1, cornerProbeDistance)]
    const incomingDirection = normalizeVector(subtractVectors(outlinePoint, behindPoint))
    const outgoingDirection = normalizeVector(subtractVectors(aheadPoint, outlinePoint))
    return Math.acos(Math.min(1, Math.max(-1, dotVectors(incomingDirection, outgoingDirection))))
  })
  const cornerIndexes = []
  for (let pointIndex = 0; pointIndex < outlinePoints.length; pointIndex++) {
    if (turnAngles[pointIndex] < cornerAngleRadians) continue
    // Keep only the sharpest point of each turn.
    const neighborhoodStart = walkAlongOutline(outlinePoints, pointIndex, -1, cornerProbeDistance)
    const neighborhoodEnd = walkAlongOutline(outlinePoints, pointIndex, 1, cornerProbeDistance)
    let isSharpestInNeighborhood = true
    for (let neighborIndex = neighborhoodStart; neighborIndex !== neighborhoodEnd; neighborIndex = (neighborIndex + 1) % outlinePoints.length) {
      if (turnAngles[neighborIndex] > turnAngles[pointIndex] || (turnAngles[neighborIndex] === turnAngles[pointIndex] && neighborIndex < pointIndex)) {
        isSharpestInNeighborhood = false
        break
      }
    }
    if (isSharpestInNeighborhood) cornerIndexes.push(pointIndex)
  }
  return cornerIndexes
}

// Evens out pixel noise along the outline, leaving the corners where they are.
function smoothOutlineBetweenCorners(outlinePoints, cornerIndexes) {
  const cornerIndexSet = new Set(cornerIndexes)
  let smoothedPoints = outlinePoints
  for (let smoothingPass = 0; smoothingPass < 2; smoothingPass++) {
    smoothedPoints = smoothedPoints.map((outlinePoint, pointIndex) => {
      if (cornerIndexSet.has(pointIndex)) return outlinePoint
      const previousPoint = smoothedPoints[(pointIndex - 1 + smoothedPoints.length) % smoothedPoints.length]
      const nextPoint = smoothedPoints[(pointIndex + 1) % smoothedPoints.length]
      return [
        outlinePoint[0] * 0.5 + (previousPoint[0] + nextPoint[0]) * 0.25,
        outlinePoint[1] * 0.5 + (previousPoint[1] + nextPoint[1]) * 0.25,
      ]
    })
  }
  return smoothedPoints
}

// ---------------------------------------------------------------- curve fitting

// Fits cubic Bezier curves through a run of outline points (the classic least-squares fit with
// Newton reparameterization, after P. J. Schneider, "An Algorithm for Automatically Fitting
// Digitized Curves", Graphics Gems, 1990), splitting the run wherever one curve strays too far.
function fitCubicCurves(runPoints, startTangent, endTangent, fitTolerance, fittedCurves) {
  if (runPoints.length === 2) {
    const runLength = vectorLength(subtractVectors(runPoints[1], runPoints[0])) / 3
    fittedCurves.push([runPoints[0], addVectors(runPoints[0], scaleVector(startTangent, runLength)), addVectors(runPoints[1], scaleVector(endTangent, runLength)), runPoints[1]])
    return
  }
  let curveParameters = chordLengthParameters(runPoints)
  let fittedCurve = leastSquaresCubicCurve(runPoints, curveParameters, startTangent, endTangent)
  let { largestSquaredError, largestErrorIndex } = largestFitError(runPoints, fittedCurve, curveParameters)
  if (largestSquaredError < fitTolerance * fitTolerance) {
    fittedCurves.push(fittedCurve)
    return
  }
  if (largestSquaredError < (fitTolerance * 4) ** 2) {
    for (let reparameterizePass = 0; reparameterizePass < 20; reparameterizePass++) {
      curveParameters = curveParameters.map((curveParameter, pointIndex) => newtonRefinedParameter(fittedCurve, runPoints[pointIndex], curveParameter))
      fittedCurve = leastSquaresCubicCurve(runPoints, curveParameters, startTangent, endTangent)
      ;({ largestSquaredError, largestErrorIndex } = largestFitError(runPoints, fittedCurve, curveParameters))
      if (largestSquaredError < fitTolerance * fitTolerance) {
        fittedCurves.push(fittedCurve)
        return
      }
    }
  }
  const splitIndex = Math.min(runPoints.length - 2, Math.max(1, largestErrorIndex))
  const splitTangent = normalizeVector(subtractVectors(runPoints[splitIndex - 1], runPoints[splitIndex + 1]))
  fitCubicCurves(runPoints.slice(0, splitIndex + 1), startTangent, splitTangent, fitTolerance, fittedCurves)
  fitCubicCurves(runPoints.slice(splitIndex), scaleVector(splitTangent, -1), endTangent, fitTolerance, fittedCurves)
}

function chordLengthParameters(runPoints) {
  const cumulativeLengths = [0]
  for (let pointIndex = 1; pointIndex < runPoints.length; pointIndex++) {
    cumulativeLengths.push(cumulativeLengths[pointIndex - 1] + vectorLength(subtractVectors(runPoints[pointIndex], runPoints[pointIndex - 1])))
  }
  const runLength = cumulativeLengths[cumulativeLengths.length - 1] || 1
  return cumulativeLengths.map((cumulativeLength) => cumulativeLength / runLength)
}

function leastSquaresCubicCurve(runPoints, curveParameters, startTangent, endTangent) {
  const firstPoint = runPoints[0]
  const lastPoint = runPoints[runPoints.length - 1]
  let c00 = 0, c01 = 0, c11 = 0, x0 = 0, x1 = 0
  curveParameters.forEach((t, pointIndex) => {
    const u = 1 - t
    const b0 = u * u * u, b1 = 3 * t * u * u, b2 = 3 * t * t * u, b3 = t * t * t
    const startInfluence = scaleVector(startTangent, b1)
    const endInfluence = scaleVector(endTangent, b2)
    c00 += dotVectors(startInfluence, startInfluence)
    c01 += dotVectors(startInfluence, endInfluence)
    c11 += dotVectors(endInfluence, endInfluence)
    const residual = subtractVectors(runPoints[pointIndex], addVectors(scaleVector(firstPoint, b0 + b1), scaleVector(lastPoint, b2 + b3)))
    x0 += dotVectors(startInfluence, residual)
    x1 += dotVectors(endInfluence, residual)
  })
  const determinant = c00 * c11 - c01 * c01
  let startHandleLength = determinant === 0 ? 0 : (x0 * c11 - x1 * c01) / determinant
  let endHandleLength = determinant === 0 ? 0 : (c00 * x1 - c01 * x0) / determinant
  const chordLength = vectorLength(subtractVectors(lastPoint, firstPoint))
  // Fall back to a third of the chord when the fit gives a backwards or runaway handle.
  if (startHandleLength < chordLength * 1e-6 || endHandleLength < chordLength * 1e-6 || startHandleLength > chordLength * 2 || endHandleLength > chordLength * 2) {
    startHandleLength = endHandleLength = chordLength / 3
  }
  return [firstPoint, addVectors(firstPoint, scaleVector(startTangent, startHandleLength)), addVectors(lastPoint, scaleVector(endTangent, endHandleLength)), lastPoint]
}

function pointOnCubicCurve([p0, p1, p2, p3], t) {
  const u = 1 - t
  return [
    u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
    u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
  ]
}

function largestFitError(runPoints, fittedCurve, curveParameters) {
  let largestSquaredError = 0
  let largestErrorIndex = Math.floor(runPoints.length / 2)
  for (let pointIndex = 1; pointIndex < runPoints.length - 1; pointIndex++) {
    const offset = subtractVectors(pointOnCubicCurve(fittedCurve, curveParameters[pointIndex]), runPoints[pointIndex])
    const squaredError = dotVectors(offset, offset)
    if (squaredError >= largestSquaredError) {
      largestSquaredError = squaredError
      largestErrorIndex = pointIndex
    }
  }
  return { largestSquaredError, largestErrorIndex }
}

function newtonRefinedParameter(fittedCurve, runPoint, t) {
  const [p0, p1, p2, p3] = fittedCurve
  const firstDerivativePoints = [subtractVectors(p1, p0), subtractVectors(p2, p1), subtractVectors(p3, p2)].map((point) => scaleVector(point, 3))
  const secondDerivativePoints = [subtractVectors(firstDerivativePoints[1], firstDerivativePoints[0]), subtractVectors(firstDerivativePoints[2], firstDerivativePoints[1])].map((point) => scaleVector(point, 2))
  const u = 1 - t
  const curvePoint = pointOnCubicCurve(fittedCurve, t)
  const firstDerivative = addVectors(addVectors(scaleVector(firstDerivativePoints[0], u * u), scaleVector(firstDerivativePoints[1], 2 * u * t)), scaleVector(firstDerivativePoints[2], t * t))
  const secondDerivative = addVectors(scaleVector(secondDerivativePoints[0], u), scaleVector(secondDerivativePoints[1], t))
  const offset = subtractVectors(curvePoint, runPoint)
  const numerator = dotVectors(offset, firstDerivative)
  const denominator = dotVectors(firstDerivative, firstDerivative) + dotVectors(offset, secondDerivative)
  if (denominator === 0) return t
  return Math.min(1, Math.max(0, t - numerator / denominator))
}

// Tangent leaving a run's first point, averaged over its first few pixels so noise does not tilt it.
function runStartTangent(runPoints) {
  const tangentProbeDistance = 3
  let probeIndex = 1
  let probedDistance = vectorLength(subtractVectors(runPoints[1], runPoints[0]))
  while (probeIndex < runPoints.length - 1 && probeIndex < runPoints.length / 2 && probedDistance < tangentProbeDistance) {
    probeIndex++
    probedDistance += vectorLength(subtractVectors(runPoints[probeIndex], runPoints[probeIndex - 1]))
  }
  return normalizeVector(subtractVectors(runPoints[probeIndex], runPoints[0]))
}

// One closed outline as cubic curves: split at its corners, each run fitted on its own; an outline
// with no corners is fitted as one run whose ends meet smoothly.
function fitOutlineCurves(outlinePoints, fitTolerance, cornerAngleDegrees) {
  const cornerIndexes = findOutlineCornerIndexes(outlinePoints, cornerAngleDegrees)
  const smoothedPoints = smoothOutlineBetweenCorners(outlinePoints, cornerIndexes)
  const fittedCurves = []
  if (cornerIndexes.length === 0) {
    const closedRunPoints = [...smoothedPoints, smoothedPoints[0]]
    const seamTangent = normalizeVector(subtractVectors(smoothedPoints[1], smoothedPoints[smoothedPoints.length - 1]))
    fitCubicCurves(closedRunPoints, seamTangent, scaleVector(seamTangent, -1), fitTolerance, fittedCurves)
    return fittedCurves
  }
  for (let cornerNumber = 0; cornerNumber < cornerIndexes.length; cornerNumber++) {
    const runStartIndex = cornerIndexes[cornerNumber]
    const runEndIndex = cornerIndexes[(cornerNumber + 1) % cornerIndexes.length]
    const runPoints = [smoothedPoints[runStartIndex]]
    for (let pointIndex = (runStartIndex + 1) % smoothedPoints.length; ; pointIndex = (pointIndex + 1) % smoothedPoints.length) {
      runPoints.push(smoothedPoints[pointIndex])
      if (pointIndex === runEndIndex) break
    }
    const reversedRunPoints = [...runPoints].reverse()
    fitCubicCurves(runPoints, runStartTangent(runPoints), runStartTangent(reversedRunPoints), fitTolerance, fittedCurves)
  }
  return fittedCurves
}

// ---------------------------------------------------------------- SVG writing

function formatSvgNumber(value) {
  const roundedValue = Math.round(value * 100) / 100
  return (Object.is(roundedValue, -0) ? 0 : roundedValue).toString()
}

// Path data for the fitted outlines, moved and scaled so the mark fills `markSize` units centered
// in the 28 x 28 grid. Nearly straight curves are written as lines.
function buildMarkPathData(inkOutlines, outlineCurves, markSize) {
  let minimumX = Infinity, minimumY = Infinity, maximumX = -Infinity, maximumY = -Infinity
  for (const outlinePoints of inkOutlines) {
    for (const [x, y] of outlinePoints) {
      minimumX = Math.min(minimumX, x); maximumX = Math.max(maximumX, x)
      minimumY = Math.min(minimumY, y); maximumY = Math.max(maximumY, y)
    }
  }
  const markScale = markSize / Math.max(maximumX - minimumX, maximumY - minimumY)
  const gridCenter = papelizMarkGridSize / 2
  const toGridPoint = ([x, y]) => [gridCenter + (x - (minimumX + maximumX) / 2) * markScale, gridCenter + (y - (minimumY + maximumY) / 2) * markScale]
  const straightCurveTolerance = 0.03
  return outlineCurves.map((fittedCurves) => {
    const outlineStartPoint = toGridPoint(fittedCurves[0][0])
    const pathCommands = [`M${formatSvgNumber(outlineStartPoint[0])} ${formatSvgNumber(outlineStartPoint[1])}`]
    for (const fittedCurve of fittedCurves) {
      const [p0, p1, p2, p3] = fittedCurve.map(toGridPoint)
      const chordDirection = normalizeVector(subtractVectors(p3, p0))
      const handleOffChord = (handlePoint) => Math.abs((handlePoint[0] - p0[0]) * chordDirection[1] - (handlePoint[1] - p0[1]) * chordDirection[0])
      if (handleOffChord(p1) < straightCurveTolerance && handleOffChord(p2) < straightCurveTolerance) {
        pathCommands.push(`L${formatSvgNumber(p3[0])} ${formatSvgNumber(p3[1])}`)
      } else {
        pathCommands.push(`C${[p1, p2, p3].map((point) => `${formatSvgNumber(point[0])} ${formatSvgNumber(point[1])}`).join(' ')}`)
      }
    }
    return `${pathCommands.join('')}Z`
  }).join('')
}

const papelizGradientDefinition = (gradientId) => `<linearGradient id="${gradientId}" gradientUnits="userSpaceOnUse" x1="3" y1="3" x2="25" y2="25">
      <stop offset="0" stop-color="${papelizGradientStartColor}"/>
      <stop offset="1" stop-color="${papelizGradientEndColor}"/>
    </linearGradient>`

function buildTracedMarkSvg(markPathData, markPaint) {
  const usesGradient = markPaint === 'gradient'
  const gradientId = 'papeliz-traced-mark-gradient'
  return `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
${usesGradient ? `  <defs>\n    ${papelizGradientDefinition(gradientId)}\n  </defs>\n` : ''}  <path fill="${usesGradient ? `url(#${gradientId})` : markPaint}" fill-rule="evenodd" d="${markPathData}"/>
</svg>
`
}

function buildTracedAppTileSvg(tileMarkPathData, isOnBlueTone) {
  const gradientId = 'papeliz-traced-app-tile-gradient'
  const gradientPaint = `url(#${gradientId})`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
  <defs>
    ${papelizGradientDefinition(gradientId)}
  </defs>
  <rect x="1" y="1" width="26" height="26" rx="${papelizAppTileCornerRadius}" fill="${isOnBlueTone ? '#fff' : gradientPaint}"/>
  <path fill="${isOnBlueTone ? gradientPaint : '#fff'}" fill-rule="evenodd" d="${tileMarkPathData}"/>
</svg>
`
}

// ---------------------------------------------------------------- run

async function runPapelizImageToSvg() {
  const imageToSvgSettings = readImageToSvgArguments(process.argv.slice(2))
  if (imageToSvgSettings.showHelp || !imageToSvgSettings.sourcePicturePath || !imageToSvgSettings.outputFolderPath) {
    process.stdout.write(papelizImageToSvgUsage)
    process.exitCode = imageToSvgSettings.showHelp ? 0 : 1
    return
  }
  const decodedPicture = decodePngPicture(await readFile(imageToSvgSettings.sourcePicturePath))
  const { inkCoverage, backgroundDescription } = measureInkCoverage(decodedPicture)
  const inkOutlines = traceInkOutlines(inkCoverage, decodedPicture.pictureWidth, decodedPicture.pictureHeight, imageToSvgSettings.minimumOutlineAreaPixels)
  if (inkOutlines.length === 0) throw new Error('No outline was found in the picture')
  const outlineCurves = inkOutlines.map((outlinePoints) => fitOutlineCurves(outlinePoints, imageToSvgSettings.curveFitTolerancePixels, imageToSvgSettings.cornerAngleDegrees))

  const markPathData = buildMarkPathData(inkOutlines, outlineCurves, papelizMarkGridSize - imageToSvgSettings.markGridPadding * 2)
  const tileMarkPathData = buildMarkPathData(inkOutlines, outlineCurves, imageToSvgSettings.appTileMarkSize)
  const tracedSvgFiles = {
    'traced-mark-gradient': buildTracedMarkSvg(markPathData, 'gradient'),
    'traced-mark-on-blue': buildTracedMarkSvg(markPathData, '#fff'),
    'traced-mark-current-color': buildTracedMarkSvg(markPathData, 'currentColor'),
    'traced-app-tile': buildTracedAppTileSvg(tileMarkPathData, false),
    'traced-app-tile-on-blue': buildTracedAppTileSvg(tileMarkPathData, true),
  }
  await mkdir(imageToSvgSettings.outputFolderPath, { recursive: true })
  for (const [tracedSvgVariant, tracedSvgText] of Object.entries(tracedSvgFiles)) {
    const tracedSvgPath = path.join(imageToSvgSettings.outputFolderPath, `${imageToSvgSettings.outputNamePrefix}-${tracedSvgVariant}.svg`)
    await writeFile(tracedSvgPath, tracedSvgText)
    console.log(`  wrote ${tracedSvgPath} (${(Buffer.byteLength(tracedSvgText) / 1024).toFixed(1)} KB)`)
  }
  const curveCount = outlineCurves.reduce((total, fittedCurves) => total + fittedCurves.length, 0)
  console.log(`  ${decodedPicture.pictureWidth} x ${decodedPicture.pictureHeight} picture on ${backgroundDescription}: ${inkOutlines.length} outline${inkOutlines.length === 1 ? '' : 's'}, ${curveCount} curves`)
}

runPapelizImageToSvg().catch((imageToSvgError) => {
  console.error(` [error] ${imageToSvgError.message}`)
  process.exitCode = 1
})
