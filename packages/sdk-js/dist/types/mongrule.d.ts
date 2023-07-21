declare type OrCondition = {
    $or: ConditionInterface[];
};
declare type NorCondition = {
    $nor: ConditionInterface[];
};
declare type AndCondition = {
    $and: ConditionInterface[];
};
declare type NotCondition = {
    $not: ConditionInterface;
};
export declare type Operator = "$in" | "$nin" | "$gt" | "$gte" | "$lt" | "$lte" | "$regex" | "$ne" | "$eq" | "$size" | "$elemMatch" | "$all" | "$not" | "$type" | "$exists" | "$vgt" | "$vgte" | "$vlt" | "$vlte" | "$vne" | "$veq";
export declare type VarType = "string" | "number" | "boolean" | "array" | "object" | "null" | "undefined";
export declare type OperatorConditionValue = {
    $in?: (string | number)[];
    $nin?: (string | number)[];
    $gt?: number | string;
    $gte?: number | string;
    $lt?: number | string;
    $lte?: number | string;
    $regex?: string;
    $ne?: number | string;
    $eq?: number | string;
    $exists?: boolean;
    $all?: ConditionValue[];
    $size?: number | ConditionValue;
    $type?: VarType;
    $elemMatch?: ConditionInterface | OperatorConditionValue;
    $not?: ConditionValue;
};
export declare type ConditionValue = OperatorConditionValue | string | number | boolean | Array<any> | Record<string, any> | null;
export declare type OperatorCondition = {
    [key: string]: ConditionValue;
};
export declare type ConditionInterface = OrCondition | NorCondition | AndCondition | NotCondition | OperatorCondition;
export declare type TestedObj = Record<string, any>;
export {};
//# sourceMappingURL=mongrule.d.ts.map