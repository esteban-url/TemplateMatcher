import * as cv from 'opencv4nodejs-prebuilt-install';
import { MatchResult, Region } from '@nut-tree/nut-js';
import { Mat, Point2, Vec3 } from 'opencv4nodejs-prebuilt-install';

export enum MethodEnum {
  TM_CCOEFF = 'TM_CCOEFF',
  TM_CCOEFF_NORMED = 'TM_CCOEFF_NORMED',
  TM_CCORR = 'TM_CCORR',
  TM_CCORR_NORMED = 'TM_CCORR_NORMED',
  TM_SQDIFF = 'TM_SQDIFF',
  TM_SQDIFF_NORMED = 'TM_SQDIFF_NORMED',
}
export type MethodNameType = `${MethodEnum}`;
export type MatchedResults = { results: Array<MatchResult>; haystack: Mat };

export class MatchTemplate {
  public static async matchImages(
    haystack: cv.Mat,
    needle: cv.Mat,
    matchedMethod: MethodNameType,
    debug: boolean = false,
  ): Promise<{
    data: MatchResult;
    haystack: {
      minVal: number;
      maxVal: number;
      minLoc: cv.Point2;
      maxLoc: cv.Point2;
    };
  }> {
    const match = await haystack.matchTemplateAsync(needle, cv[matchedMethod]);
    const minMax = await match.minMaxLocAsync();

    const isMethodTypeMaxOrMin = matchedMethod === MethodEnum.TM_SQDIFF_NORMED || matchedMethod === MethodEnum.TM_SQDIFF;
    let locType: 'minLoc' | 'maxLoc' = isMethodTypeMaxOrMin ? 'minLoc' : 'maxLoc';

    if (debug) {
      cv.imshow('debug', haystack);
      cv.waitKey(0);
    }

    return {
      data: new MatchResult(
        isMethodTypeMaxOrMin ? 1.0 - minMax.minVal : minMax.maxVal,
        new Region((minMax[locType as keyof typeof minMax] as Point2).x, (minMax[locType as keyof typeof minMax] as Point2).y, needle.cols, needle.rows),
      ),
      haystack: minMax,
    };
  }

  public static async matchImagesByWriteOverFounded(
    haystack: cv.Mat,
    needle: cv.Mat,
    confidence: number,
    matchedMethod: MethodNameType,
    debug: boolean = false,
    firstMach: boolean = false,
  ): Promise<MatchedResults> {
    const h = needle.rows;
    const w = needle.cols;
    let minVal = 0;
    let maxVal = 1;
    let minMax, match;
    let matchedResults: Array<MatchResult> = [];
    let prevMinVal,
      prevMaxVal = 0;
    let prevMinLoc,
      prevMaxLoc = {};

    const isMethodTypeMaxOrMin = matchedMethod === MethodEnum.TM_SQDIFF_NORMED || matchedMethod === MethodEnum.TM_SQDIFF;
    let locType: 'minLoc' | 'maxLoc' = isMethodTypeMaxOrMin ? 'minLoc' : 'maxLoc';

    while (isMethodTypeMaxOrMin ? minVal <= confidence : maxVal > confidence) {
      match = await haystack.matchTemplateAsync(needle, cv[`${matchedMethod}`]);
      minMax = await match.minMaxLocAsync();
      minVal = minMax.minVal;
      maxVal = minMax.maxVal;
      let { maxLoc, minLoc } = minMax;

      if (prevMinVal === minVal && prevMaxVal === maxVal && JSON.stringify(prevMinLoc) === JSON.stringify(minLoc) && JSON.stringify(prevMaxLoc) === JSON.stringify(maxLoc)) {
        break;
      } else {
        prevMinVal = minVal;
        prevMaxVal = maxVal;
        prevMinLoc = minLoc;
        prevMaxLoc = maxLoc;
      }

      if (isMethodTypeMaxOrMin ? minVal <= confidence : maxVal > confidence) {
        const region = MatchTemplate.getRectangleRegion(minMax, { height: h, width: w }, locType);
        haystack = MatchTemplate.fillReginBlackColor(haystack, { xL: region.xL, yL: region.yL, xR: region.xR, yR: region.yR });
        matchedResults.push(
          new MatchResult(
            isMethodTypeMaxOrMin ? 1.0 - minMax.minVal : minMax.maxVal,
            new Region((minMax[locType as keyof typeof minMax] as Point2).x, (minMax[locType as keyof typeof minMax] as Point2).y, needle.cols, needle.rows),
          ),
        );
        if (debug) {
          cv.imshow('debug iteration', haystack);
          cv.waitKey(0);
        }

        if (firstMach && matchedResults.length && matchedResults[0].confidence >= confidence) {
          return { results: matchedResults, haystack: haystack };
        }
      }
    }
    if (debug) {
      cv.imshow('debug result', haystack);
      cv.waitKey(0);
    }
    return { results: matchedResults, haystack: haystack };
  }

  public static fillReginBlackColor(haystack: cv.Mat, poligon: { xL: number; yL: number; xR: number; yR: number }, color: Vec3 = new Vec3(0, 255, 0)): Mat {
    haystack.drawFillPoly([[new Point2(poligon.xL, poligon.yL), new Point2(poligon.xR, poligon.yL), new Point2(poligon.xR, poligon.yR), new Point2(poligon.xL, poligon.yR)]], color);

    return haystack;
  }

  public static getRectangleRegion(
    minMax: {
      minVal: number;
      maxVal: number;
      minLoc: cv.Point2;
      maxLoc: cv.Point2;
    },
    size: { width: number; height: number },
    locType: 'minLoc' | 'maxLoc',
  ) {
    const xL = (minMax[locType as keyof typeof minMax] as Point2).x >= 0 ? (minMax[locType as keyof typeof minMax] as Point2).x : 0;
    const yL = (minMax[locType as keyof typeof minMax] as Point2).y >= 0 ? (minMax[locType as keyof typeof minMax] as Point2).y : 0;
    const xR = (minMax[locType as keyof typeof minMax] as Point2).x + size.width + 1 >= 0 ? (minMax[locType as keyof typeof minMax] as Point2).x + size.width + 1 : 0;
    const yR = (minMax[locType as keyof typeof minMax] as Point2).y + size.height + 1 >= 0 ? (minMax[locType as keyof typeof minMax] as Point2).y + size.height + 1 : 0;

    return { xL: xL, yL: yL, xR: xR, yR: yR };
  }
}
