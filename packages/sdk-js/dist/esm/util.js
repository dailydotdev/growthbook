function hashFnv32a(str) {
  let hval = 0x811c9dc5;
  const l = str.length;
  for (let i = 0; i < l; i++) {
    hval ^= str.charCodeAt(i);
    hval += (hval << 1) + (hval << 4) + (hval << 7) + (hval << 8) + (hval << 24);
  }
  return hval >>> 0;
}
export function hash(seed, value, version) {
  // New unbiased hashing algorithm
  if (version === 2) {
    return hashFnv32a(hashFnv32a(seed + value) + "") % 10000 / 10000;
  }
  // Original biased hashing algorithm (keep for backwards compatibility)
  if (version === 1) {
    return hashFnv32a(value + seed) % 1000 / 1000;
  }

  // Unknown hash version
  return null;
}
export function getEqualWeights(n) {
  if (n <= 0) return [];
  return new Array(n).fill(1 / n);
}
export function inRange(n, range) {
  return n >= range[0] && n < range[1];
}
export function inNamespace(hashValue, namespace) {
  const n = hash("__" + namespace[0], hashValue, 1);
  if (n === null) return false;
  return n >= namespace[1] && n < namespace[2];
}
export function chooseVariation(n, ranges) {
  for (let i = 0; i < ranges.length; i++) {
    if (inRange(n, ranges[i])) {
      return i;
    }
  }
  return -1;
}
export function getUrlRegExp(regexString) {
  try {
    const escaped = regexString.replace(/([^\\])\//g, "$1\\/");
    return new RegExp(escaped);
  } catch (e) {
    console.error(e);
    return undefined;
  }
}
export function isURLTargeted(url, targets) {
  if (!targets.length) return false;
  let hasIncludeRules = false;
  let isIncluded = false;
  for (let i = 0; i < targets.length; i++) {
    const match = _evalURLTarget(url, targets[i].type, targets[i].pattern);
    if (targets[i].include === false) {
      if (match) return false;
    } else {
      hasIncludeRules = true;
      if (match) isIncluded = true;
    }
  }
  return isIncluded || !hasIncludeRules;
}
function _evalSimpleUrlPart(actual, pattern, isPath) {
  try {
    // Escape special regex characters and change wildcard `_____` to `.*`
    let escaped = pattern.replace(/[*.+?^${}()|[\]\\]/g, "\\$&").replace(/_____/g, ".*");
    if (isPath) {
      // When matching pathname, make leading/trailing slashes optional
      escaped = "\\/?" + escaped.replace(/(^\/|\/$)/g, "") + "\\/?";
    }
    const regex = new RegExp("^" + escaped + "$", "i");
    return regex.test(actual);
  } catch (e) {
    return false;
  }
}
function _evalSimpleUrlTarget(actual, pattern) {
  try {
    // If a protocol is missing, but a host is specified, add `https://` to the front
    // Use "_____" as the wildcard since `*` is not a valid hostname in some browsers
    const expected = new URL(pattern.replace(/^([^:/?]*)\./i, "https://$1.").replace(/\*/g, "_____"), "https://_____");

    // Compare each part of the URL separately
    const comps = [[actual.host, expected.host, false], [actual.pathname, expected.pathname, true]];
    // We only want to compare hashes if it's explicitly being targeted
    if (expected.hash) {
      comps.push([actual.hash, expected.hash, false]);
    }
    expected.searchParams.forEach((v, k) => {
      comps.push([actual.searchParams.get(k) || "", v, false]);
    });

    // If any comparisons fail, the whole thing fails
    return !comps.some(data => !_evalSimpleUrlPart(data[0], data[1], data[2]));
  } catch (e) {
    return false;
  }
}
function _evalURLTarget(url, type, pattern) {
  try {
    const parsed = new URL(url, "https://_");
    if (type === "regex") {
      const regex = getUrlRegExp(pattern);
      if (!regex) return false;
      return regex.test(parsed.href) || regex.test(parsed.href.substring(parsed.origin.length));
    } else if (type === "simple") {
      return _evalSimpleUrlTarget(parsed, pattern);
    }
    return false;
  } catch (e) {
    return false;
  }
}
export function getBucketRanges(numVariations, coverage, weights) {
  coverage = coverage === undefined ? 1 : coverage;

  // Make sure coverage is within bounds
  if (coverage < 0) {
    if (process.env.NODE_ENV !== "production") {
      console.error("Experiment.coverage must be greater than or equal to 0");
    }
    coverage = 0;
  } else if (coverage > 1) {
    if (process.env.NODE_ENV !== "production") {
      console.error("Experiment.coverage must be less than or equal to 1");
    }
    coverage = 1;
  }

  // Default to equal weights if missing or invalid
  const equal = getEqualWeights(numVariations);
  weights = weights || equal;
  if (weights.length !== numVariations) {
    if (process.env.NODE_ENV !== "production") {
      console.error("Experiment.weights array must be the same length as Experiment.variations");
    }
    weights = equal;
  }

  // If weights don't add up to 1 (or close to it), default to equal weights
  const totalWeight = weights.reduce((w, sum) => sum + w, 0);
  if (totalWeight < 0.99 || totalWeight > 1.01) {
    if (process.env.NODE_ENV !== "production") {
      console.error("Experiment.weights must add up to 1");
    }
    weights = equal;
  }

  // Covert weights to ranges
  let cumulative = 0;
  return weights.map(w => {
    const start = cumulative;
    cumulative += w;
    return [start, start + coverage * w];
  });
}
export function getQueryStringOverride(id, url, numVariations) {
  if (!url) {
    return null;
  }
  const search = url.split("?")[1];
  if (!search) {
    return null;
  }
  const match = search.replace(/#.*/, "") // Get rid of anchor
  .split("&") // Split into key/value pairs
  .map(kv => kv.split("=", 2)).filter(_ref => {
    let [k] = _ref;
    return k === id;
  }) // Look for key that matches the experiment id
  .map(_ref2 => {
    let [, v] = _ref2;
    return parseInt(v);
  }); // Parse the value into an integer

  if (match.length > 0 && match[0] >= 0 && match[0] < numVariations) return match[0];
  return null;
}
export function isIncluded(include) {
  try {
    return include();
  } catch (e) {
    console.error(e);
    return false;
  }
}
const base64ToBuf = b => Uint8Array.from(atob(b), c => c.charCodeAt(0));
export async function decrypt(encryptedString, decryptionKey, subtle) {
  decryptionKey = decryptionKey || "";
  subtle = subtle || globalThis.crypto && globalThis.crypto.subtle;
  if (!subtle) {
    throw new Error("No SubtleCrypto implementation found");
  }
  try {
    const key = await subtle.importKey("raw", base64ToBuf(decryptionKey), {
      name: "AES-CBC",
      length: 128
    }, true, ["encrypt", "decrypt"]);
    const [iv, cipherText] = encryptedString.split(".");
    const plainTextBuffer = await subtle.decrypt({
      name: "AES-CBC",
      iv: base64ToBuf(iv)
    }, key, base64ToBuf(cipherText));
    return new TextDecoder().decode(plainTextBuffer);
  } catch (e) {
    throw new Error("Failed to decrypt");
  }
}
export function paddedVersionString(input) {
  // Remove build info and leading `v` if any
  // Split version into parts (both core version numbers and pre-release tags)
  // "v1.2.3-rc.1+build123" -> ["1","2","3","rc","1"]
  const parts = input.replace(/(^v|\+.*$)/g, "").split(/[-.]/);

  // If it's SemVer without a pre-release, add `~` to the end
  // ["1","0","0"] -> ["1","0","0","~"]
  // "~" is the largest ASCII character, so this will make "1.0.0" greater than "1.0.0-beta" for example
  if (parts.length === 3) {
    parts.push("~");
  }

  // Left pad each numeric part with spaces so string comparisons will work ("9">"10", but " 9"<"10")
  // Then, join back together into a single string
  return parts.map(v => v.match(/^[0-9]+$/) ? v.padStart(5, " ") : v).join("-");
}
//# sourceMappingURL=util.js.map