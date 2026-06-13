package com.nuexis.player

import android.app.Application
import androidx.room.Room
import com.nuexis.player.data.local.PlayerDatabase

class PlayerApp : Application() {

    lateinit var database: PlayerDatabase
        private set

    override fun onCreate() {
        super.onCreate()

        database = Room.databaseBuilder(
            applicationContext,
            PlayerDatabase::class.java,
            "nuexis_player_db"
        )
        .fallbackToDestructiveMigration()
        .build()
    }
}
