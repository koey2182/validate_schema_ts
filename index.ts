import { filter, map, pipe, toArray } from '@fxts/core';
import { parse } from 'date-fns';

export type ValidateSchema =
    | StringValidateSchema
    | NumberValidateSchema
    | BooleanValidateSchema
    | ObjectValidateSchema
    | ArrayValidateSchema;
export type StringValidateSchema = {
    type: 'string';
    nullable?: boolean;
    description?: string;
    minLength?: number;
    maxLength?: number;
    regex?: RegExp;
    dateFormat?: string;
    startsWith?: string;
    endsWith?: string;
    includes?: string;
    in?: string[];
    notIn?: string[];
};
export type NumberValidateSchema = {
    type: 'number';
    description?: string;
    nullable?: boolean;
    min?: number;
    max?: number;
    in?: number[];
    notIn?: number[];
};
export type BooleanValidateSchema = {
    type: 'boolean';
    description?: string;
    nullable?: boolean;
};
type Properties = { [k: string]: ValidateSchema };
export type ObjectValidateSchema = {
    type: 'object';
    description?: string;
    nullable?: boolean;
    properties: Properties;
};
export type ArrayValidateSchema = {
    type: 'array';
    description?: string;
    nullable?: boolean;
    items: ValidateSchema;
    minLength?: number;
    maxLength?: number;
    every?: (x: any) => boolean;
    some?: (x: any) => boolean;
    none?: (x: any) => boolean;
};
export type ValidObject<T extends Properties> = {
    [K in keyof T]: TypeFromSchema<T[K]>;
};
type IsNullable<T> = [T] extends [true]
    ? true
    : [T] extends [false]
    ? false
    : [T] extends [boolean]
    ? true
    : false;
export type TypeFromSchema<T extends ValidateSchema> = T extends { type: 'string' }
    ? IsNullable<T['nullable']> extends true
        ? string | null | undefined
        : string
    : T extends { type: 'number' }
    ? IsNullable<T['nullable']> extends true
        ? number | null | undefined
        : number
    : T extends { type: 'boolean' }
    ? IsNullable<T['nullable']> extends true
        ? boolean | null | undefined
        : boolean
    : T extends { type: 'object' }
    ? IsNullable<T['nullable']> extends true
        ? ValidObject<T['properties']> | null | undefined
        : ValidObject<T['properties']>
    : T extends { type: 'array' }
    ? IsNullable<T['nullable']> extends true
        ? TypeFromSchema<T['items']>[] | null | undefined
        : TypeFromSchema<T['items']>[]
    : unknown;

export function validateObject<T extends ObjectValidateSchema>(
    target: unknown,
    schema: T,
): TypeFromSchema<T> {
    const { nullable, properties, description: desc } = schema;
    const description = desc ?? '값';
    if (target == null) {
        if (!nullable) {
            throw `${description}을 입력하세요.`;
        }
        return target as any;
    }
    if (typeof target !== 'object') {
        throw `${description}은 object 타입이어야 합니다.`;
    }

    return Object.fromEntries(
        pipe(
            Object.entries(properties),
            map(([propertyName, propertySchema]) => {
                const property = (target as Record<string, unknown>)[propertyName];
                return [propertyName, validate(property, propertySchema)];
            }),
            toArray,
        ),
    );
}
export function validateArray<T extends ArrayValidateSchema>(
    target: unknown,
    schema: T,
): TypeFromSchema<T> {
    const { description: desc, items: itemSchema, nullable, some, every, none } = schema;
    const description = desc ?? '값';

    if (target == null) {
        if (!nullable) {
            throw `${description}을 입력해주세요.`;
        }
        return target as any;
    }
    if (!Array.isArray(target)) {
        throw `${description}은 array 타입이어야 합니다.`;
    }
    let checkSome = some == null;
    let checkEvery = every == null;
    let checkNone = none == null;
    const result = pipe(
        target,
        filter((x) => x != null || itemSchema.nullable),
        map((x) => {
            const valid = validate(x, itemSchema);

            if (!checkSome && some) {
                checkSome = checkSome || some(valid);
            }
            if (checkEvery && every) {
                checkEvery = checkEvery && every(valid);
            }
            if (checkNone && none) {
                checkNone = checkNone && !none(valid);
            }

            return valid;
        }),
        toArray,
    );

    if (!checkSome || !checkEvery || !checkNone) {
        throw `${description}이 주어진 조건을 만족하지 않습니다.`;
    }

    return result as any;
}
export function validateString<T extends StringValidateSchema>(
    target: unknown,
    schema: T,
): TypeFromSchema<T> {
    const {
        description: desc,
        minLength,
        maxLength,
        regex,
        dateFormat,
        startsWith,
        endsWith,
        includes,
        nullable,
        in: inn,
        notIn,
    } = schema;

    const description = desc ?? '값';
    if (target == null) {
        if (!nullable) {
            throw `${description}을 입력해주세요.`;
        }
        return target as TypeFromSchema<T>;
    }
    if (typeof target !== 'string') {
        throw `${description}은 string 타입이어야 합니다.`;
    }
    if (minLength != null && target.length < minLength) {
        throw `${description}은 ${minLength}자 이상이어야 합니다.`;
    }
    if (maxLength != null && maxLength < target.length) {
        throw `${description}은 ${maxLength}자 이하여야 합니다.`;
    }
    if (regex && !regex.test(target)) {
        throw `${description}은 다음의 정규표현식을 만족해야 합니다. (${regex})`;
    }
    if (dateFormat && isNaN(parse(target, dateFormat, new Date()).getTime())) {
        throw `${description}은 다음의 날짜형식을 만족해야 합니다. (${dateFormat})`;
    }
    if (startsWith && !target.startsWith(startsWith)) {
        throw `${description}은 다음의 값으로 시작해야 합니다. (${startsWith})`;
    }
    if (endsWith && !target.endsWith(endsWith)) {
        throw `${description}은 다음의 값으로 끝나야 합니다. (${endsWith})`;
    }
    if (includes && !target.includes(includes)) {
        throw `${description}은 다음의 값을 포함해야 합니다. (${includes})`;
    }
    if (inn && !inn.includes(target)) {
        throw `${description}은 다음의 값 중 하나여야 합니다. (${JSON.stringify(inn)})`;
    }
    if (notIn && notIn.includes(target)) {
        throw `${description}은 다음의 값들이 아니어야 합니다. (${JSON.stringify(notIn)})`;
    }

    return target as TypeFromSchema<T>;
}
export function validateNumber<T extends NumberValidateSchema>(
    target: unknown,
    schema: T,
): TypeFromSchema<T> {
    const { min, max, in: inn, notIn, nullable, description: desc } = schema;
    const description = desc ?? '값';
    if (target == null) {
        if (!nullable) {
            throw `${description}을 입력해주세요`;
        }
        return target as any;
    }
    if (typeof target !== 'number') {
        throw `${description}은 number 타입이어야 합니다.`;
    }
    if (min != null && target < min) {
        throw `${description}은 ${min} 이상이어야 합니다.`;
    }
    if (max != null && max < target) {
        throw `${description}은 ${max} 이하여야 합니다.`;
    }
    if (inn && !inn.includes(target)) {
        throw `${description}은 다음의 값들 중 하나여야 합니다. (${JSON.stringify(new Set(inn))})`;
    }
    if (notIn && notIn.includes(target)) {
        throw `${description}은 다음의 값들에 해당되지 않아야 합니다. (${JSON.stringify(
            new Set(notIn),
        )})`;
    }
    return target as TypeFromSchema<T>;
}
export function validateBoolean<T extends BooleanValidateSchema>(
    target: unknown,
    schema: T,
): TypeFromSchema<T> {
    const { description: desc, nullable } = schema;
    const description = desc ?? '값';
    if (target == null) {
        if (!nullable) {
            throw `${description}을 입력해주세요.`;
        }
        return target as TypeFromSchema<T>;
    }
    if (typeof target !== 'boolean') {
        throw `${description}은 boolean 타입이어야 합니다.`;
    }

    return target as TypeFromSchema<T>;
}

export function validate<T extends ValidateSchema>(target: unknown, schema: T): TypeFromSchema<T> {
    const type = schema.type;
    switch (type) {
        case 'number':
            return validateNumber(target, schema) as any;
        case 'string':
            return validateString(target, schema) as any;
        case 'boolean':
            return validateBoolean(target, schema) as any;
        case 'object':
            return validateObject(target, schema) as any;
        case 'array':
            return validateArray(target, schema) as any;
        default:
            throw `지원하지 않는 타입입니다. (${type})`;
    }
}

export function example() {
    const bool = !isNaN(parseInt('qwe1234'));
    const data = validate(
        {
            name: '민혁',
            idsToDelete: [1, 2, 3, undefined, null],
            itemInfo: {
                name: '안녕하세요',
                phone: '1234567890123',
            },
        },
        {
            type: 'object',
            // nullable: false,
            // items: { type: 'number', nullable: bool },
            properties: {
                name: {
                    type: 'string',
                    minLength: 2,
                    maxLength: 20,
                    description: '이름',
                    nullable: bool,
                },
                idsToDelete: {
                    type: 'array',
                    items: { type: 'number', description: '삭제할 아이디' },
                },
                // itemInfo: {
                //     type: 'object',
                //     properties: {
                //         name: { type: 'string', maxLength: 10 },
                //         phone: { type: 'string', regex: /^\d{12,14}$/ },
                //     },
                // },
            },
        },
    );

    console.log(data);
}
