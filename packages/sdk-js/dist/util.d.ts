import { UrlTarget, VariationRange } from "./types/growthbook";
export declare function hash(seed: string, value: string, version: number): number | null;
export declare function getEqualWeights(n: number): number[];
export declare function inRange(n: number, range: VariationRange): boolean;
export declare function inNamespace(hashValue: string, namespace: [string, number, number]): boolean;
export declare function chooseVariation(n: number, ranges: VariationRange[]): number;
export declare function getUrlRegExp(regexString: string): RegExp | undefined;
export declare function isURLTargeted(url: string, targets: UrlTarget[]): boolean;
export declare function getBucketRanges(numVariations: number, coverage: number | undefined, weights?: number[]): VariationRange[];
export declare function getQueryStringOverride(id: string, url: string, numVariations: number): number | null;
export declare function isIncluded(include: () => boolean): boolean;
export declare function decrypt(encryptedString: string, decryptionKey?: string, subtle?: SubtleCrypto): Promise<string>;
export declare function paddedVersionString(input: string): string;
//# sourceMappingURL=util.d.ts.map