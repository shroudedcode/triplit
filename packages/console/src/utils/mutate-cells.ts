import { TriplitClient } from '@triplit/client';

export type TriplitDataTypes =
  | string
  | number
  | boolean
  | Date
  | null
  | Record<string, any>;

export async function updateTriplitValue(
  attribute: string,
  client: TriplitClient,
  collection: string,
  entityId: string,
  value: TriplitDataTypes & undefined
) {
  try {
    await client.update(collection, entityId, async (originalEntity) => {
      const path = attribute.split('.');
      let entityCopy = originalEntity;
      while (path.length > 1) {
        const key = path.shift();
        entityCopy = entityCopy[key];
      }
      entityCopy[path[0]] = value;
    });
  } catch (e) {
    console.error(e);
  }
}

export async function deleteTriplitValue(
  attribute: string,
  client: TriplitClient,
  collection: string,
  entityId: string
) {
  try {
    await client.update(collection, entityId, async (originalEntity) => {
      const path = attribute.split('.');
      let entityCopy = originalEntity;
      while (path.length > 1) {
        const key = path.shift();
        entityCopy = entityCopy[key];
      }
      delete entityCopy[path[0]];
    });
  } catch (e) {
    console.error(e);
  }
}

export async function updateTriplitSet(
  attribute: string,
  client: TriplitClient,
  collection: string,
  entityId: string,
  value: TriplitDataTypes,
  action: 'add' | 'delete' | 'null'
) {
  try {
    await client.update(collection, entityId, async (originalEntity) => {
      console.log('originalEntity', originalEntity);
      const path = attribute.split('.');
      let entityCopy = originalEntity;
      while (path.length > 1) {
        const key = path.shift();
        entityCopy = entityCopy[key];
      }
      const possiblyNestedSet = entityCopy[path[0]];
      console.log('possiblyNestedSet', possiblyNestedSet);
      if (action === 'add') {
        if (possiblyNestedSet === null || possiblyNestedSet === undefined) {
          entityCopy[path[0]] = new Set([value]);
          return;
        }
        if (possiblyNestedSet instanceof Set) {
          possiblyNestedSet.add(value);
          return;
        }
      } else if (action === 'delete' && possiblyNestedSet instanceof Set) {
        const deleted = possiblyNestedSet.delete(value);
        if (!deleted && value instanceof Date) {
          const dateObjToDelete = Array.from(
            possiblyNestedSet as Set<Date>
          ).find((date: Date) => date.toISOString() === value.toISOString());
          if (dateObjToDelete) {
            possiblyNestedSet.delete(dateObjToDelete);
          }
        }
      }
    });
  } catch (e) {
    console.error(e);
  }
}
