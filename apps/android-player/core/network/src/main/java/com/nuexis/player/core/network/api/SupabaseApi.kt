package com.nuexis.player.core.network.api

import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.POST

interface SupabaseApi {

    @POST("rest/v1/rpc/register_player_device")
    suspend fun registerDevice(
        @Body request: RpcRegisterDeviceRequest
    ): Response<RpcRegisterDeviceResponse>

    @POST("rest/v1/rpc/refresh_player_device_code")
    suspend fun refreshDeviceCode(
        @Body request: RpcRefreshDeviceRequest
    ): Response<RpcRefreshDeviceResponse>

    @POST("rest/v1/rpc/get_player_device_state")
    suspend fun getDeviceState(
        @Body request: RpcDeviceStateRequest
    ): Response<RpcDeviceStateResponse>

    @POST("rest/v1/rpc/get_player_playlist_items")
    suspend fun getPlaylistItems(
        @Body request: RpcPlaylistItemsRequest
    ): Response<List<RpcPlaylistItemResponse>>

    @POST("rest/v1/rpc/increment_device_playtime")
    suspend fun incrementPlaytime(
        @Body request: RpcIncrementPlaytimeRequest
    ): Response<Unit>

    @POST("rest/v1/rpc/get_player_signed_media_url")
    suspend fun getPlayerSignedMediaUrl(
        @Body request: RpcSignedMediaUrlRequest
    ): Response<String>
}
