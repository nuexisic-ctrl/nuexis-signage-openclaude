package com.nuexis.player.data.db

import androidx.room.*

@Dao
interface CacheEntryDao {
    @Query("SELECT * FROM cache_entries WHERE `key` = :key LIMIT 1")
    suspend fun getByKey(key: String): CacheEntry?

    @Query("SELECT * FROM cache_entries WHERE generation = :generation")
    suspend fun getByGeneration(generation: String): List<CacheEntry>

    @Query("SELECT * FROM cache_entries WHERE status = :status")
    suspend fun getByStatus(status: String): List<CacheEntry>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertOrUpdate(entry: CacheEntry)

    @Delete
    suspend fun delete(entry: CacheEntry)

    @Query("DELETE FROM cache_entries WHERE `key` = :key")
    suspend fun deleteByKey(key: String)

    @Query("SELECT SUM(size_bytes) FROM cache_entries WHERE generation = :generation")
    suspend fun getTotalSizeByGeneration(generation: String): Long?

    @Query("SELECT * FROM cache_entries ORDER BY last_used_at ASC")
    suspend fun getAllOrderByLastUsed(): List<CacheEntry>
}
