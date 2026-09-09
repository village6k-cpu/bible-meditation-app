// 공유하는 db 레이어는 expo-sqlite의 '타입'만 참조한다(값은 쓰지 않는다).
// 브라우저 빌드에서는 import 자체가 지워지므로, 타입만 여기서 선언해 준다.
declare module 'expo-sqlite' {
  export interface SQLiteDatabase {
    execAsync(sql: string): Promise<void>;
    getFirstAsync<T>(sql: string, params?: unknown[]): Promise<T | null>;
    getAllAsync<T>(sql: string, params?: unknown[]): Promise<T[]>;
    runAsync(sql: string, params?: unknown[]): Promise<unknown>;
    withTransactionAsync(fn: () => Promise<void>): Promise<void>;
  }
}
