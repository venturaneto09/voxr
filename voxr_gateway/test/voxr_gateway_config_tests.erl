%% SPDX-License-Identifier: AGPL-3.0-or-later

-module(voxr_gateway_config_tests).
-typing([eqwalizer]).
-include_lib("eunit/include/eunit.hrl").

cluster_defaults_test() ->
    Config = voxr_gateway_config:build_config(#{}),
    ?assertEqual(false, maps:get(cluster_enabled, Config)),
    ?assertEqual(undefined, maps:get(cluster_discovery_dns_name, Config)),
    ?assertEqual(undefined, maps:get(cluster_discovery_node_basename, Config)),
    ?assertEqual(5000, maps:get(cluster_discovery_poll_interval_ms, Config)),
    ?assertEqual([], maps:get(cluster_static_peers, Config)).

cluster_overrides_test() ->
    RawConfig = #{
        <<"services">> => #{
            <<"gateway">> => #{
                <<"cluster_enabled">> => true,
                <<"cluster_discovery_dns_name">> =>
                    <<"voxr-gateway-headless.voxr.svc.cluster.local">>,
                <<"cluster_discovery_node_basename">> => <<"voxr_gateway">>,
                <<"cluster_discovery_poll_interval_ms">> => 2500,
                <<"cluster_static_peers">> =>
                    <<"voxr_gateway_websocket_1@127.0.0.1, voxr_gateway_sessions_1@127.0.0.1">>
            }
        }
    },
    Config = voxr_gateway_config:build_config(RawConfig),
    ?assertEqual(true, maps:get(cluster_enabled, Config)),
    ?assertEqual(
        "voxr-gateway-headless.voxr.svc.cluster.local",
        maps:get(cluster_discovery_dns_name, Config)
    ),
    ?assertEqual(
        "voxr_gateway",
        maps:get(cluster_discovery_node_basename, Config)
    ),
    ?assertEqual(2500, maps:get(cluster_discovery_poll_interval_ms, Config)),
    ?assertEqual(
        [
            list_to_atom("voxr_gateway_websocket_1@127.0.0.1"),
            list_to_atom("voxr_gateway_sessions_1@127.0.0.1")
        ],
        maps:get(cluster_static_peers, Config)
    ).

cluster_static_peers_rejects_invalid_node_names_test() ->
    LongPeer = list_to_binary(lists:duplicate(260, $a)),
    RawConfig = #{
        <<"services">> => #{
            <<"gateway">> => #{
                <<"cluster_static_peers">> => <<
                    "valid_peer@127.0.0.1,",
                    "invalid peer@127.0.0.2,",
                    "missing-host@,",
                    LongPeer/binary,
                    ",other-valid@node.local"
                >>
            }
        }
    },
    ?assertError(
        {invalid_cluster_static_peer, "invalid peer@127.0.0.2"},
        voxr_gateway_config:build_config(RawConfig)
    ).

cluster_static_peers_accepts_valid_node_names_test() ->
    RawConfig = #{
        <<"services">> => #{
            <<"gateway">> => #{
                <<"cluster_static_peers">> =>
                    <<"valid_peer@127.0.0.1,other-valid@node.local">>
            }
        }
    },
    Config = voxr_gateway_config:build_config(RawConfig),
    ?assertEqual(
        [list_to_atom("valid_peer@127.0.0.1"), list_to_atom("other-valid@node.local")],
        maps:get(cluster_static_peers, Config)
    ).

presence_push_buffer_env_defaults_test() ->
    with_env("VOXR_GATEWAY_PRESENCE_PUSH_BUFFER_MAX_ENTRIES", "7", fun() ->
        with_env("VOXR_GATEWAY_PRESENCE_PUSH_BUFFER_MAX_BYTES", "4096", fun() ->
            Config = voxr_gateway_config:load(),
            ?assertEqual(7, maps:get(presence_push_buffer_max_entries, Config)),
            ?assertEqual(4096, maps:get(presence_push_buffer_max_bytes, Config))
        end)
    end).

env_only_push_and_http_runtime_config_test() ->
    ApnsAppsJson =
        "[{\"app_id\":\"ios-stable\",\"topic\":\"app.voxr\",\"environment\":\"production\"}]",
    FcmAppsJson = "[{\"app_id\":\"android-stable\",\"project_id\":\"voxr-fcm\"}]",
    with_envs(
        [
            {"VOXR_GATEWAY_SHUTDOWN_DRAIN_WAIT_MS", "1234"},
            {"VOXR_GATEWAY_HTTP_RPC_MAX_CONCURRENCY", "42"},
            {"VOXR_GATEWAY_HTTP_FAILURE_THRESHOLD", "9"},
            {"VOXR_GATEWAY_HTTP_RECOVERY_TIMEOUT_MS", "6000"},
            {"VOXR_PUSH_APNS_ENABLED", "true"},
            {"VOXR_PUSH_APNS_TEAM_ID", "TEAMID"},
            {"VOXR_PUSH_APNS_KEY_ID", "KEYID"},
            {"VOXR_PUSH_APNS_PRIVATE_KEY_PATH", "/etc/voxr/apns.p8"},
            {"VOXR_PUSH_APNS_DEFAULT_ENVIRONMENT", "development"},
            {"VOXR_PUSH_APNS_APPS", ApnsAppsJson},
            {"VOXR_PUSH_FCM_ENABLED", "true"},
            {"VOXR_PUSH_FCM_PROJECT_ID", "voxr-fcm"},
            {"VOXR_PUSH_FCM_SERVICE_ACCOUNT_JSON_PATH", "/etc/voxr/fcm.json"},
            {"VOXR_PUSH_FCM_TOKEN_URI", "https://oauth2.example/token"},
            {"VOXR_PUSH_FCM_APPS", FcmAppsJson}
        ],
        fun() ->
            Config = voxr_gateway_config:load(),
            ?assertEqual(1234, maps:get(shutdown_drain_wait_ms, Config)),
            ?assertEqual(42, maps:get(gateway_http_rpc_max_concurrency, Config)),
            ?assertEqual(9, maps:get(gateway_http_failure_threshold, Config)),
            ?assertEqual(6000, maps:get(gateway_http_recovery_timeout_ms, Config)),
            ?assertEqual(true, maps:get(apns_enabled, Config)),
            ?assertEqual(<<"TEAMID">>, maps:get(apns_team_id, Config)),
            ?assertEqual(<<"KEYID">>, maps:get(apns_key_id, Config)),
            ?assertEqual(<<"development">>, maps:get(apns_default_environment, Config)),
            ?assertEqual(
                [
                    #{
                        <<"app_id">> => <<"ios-stable">>,
                        <<"topic">> => <<"app.voxr">>,
                        <<"environment">> => <<"production">>
                    }
                ],
                maps:get(apns_apps, Config)
            ),
            ?assertEqual(true, maps:get(fcm_enabled, Config)),
            ?assertEqual(<<"voxr-fcm">>, maps:get(fcm_project_id, Config)),
            ?assertEqual(<<"https://oauth2.example/token">>, maps:get(fcm_token_uri, Config)),
            ?assertEqual(
                [#{<<"app_id">> => <<"android-stable">>, <<"project_id">> => <<"voxr-fcm">>}],
                maps:get(fcm_apps, Config)
            )
        end
    ).

rpc_concurrency_keys_are_independent_test() ->
    with_envs(
        [
            {"VOXR_GATEWAY_HTTP_RPC_MAX_CONCURRENCY", "128"},
            {"VOXR_GATEWAY_NATS_RPC_MAX_HANDLERS", "2048"}
        ],
        fun() ->
            Config = voxr_gateway_config:load(),
            ?assertEqual(128, maps:get(gateway_http_rpc_max_concurrency, Config)),
            ?assertEqual(2048, maps:get(gateway_nats_rpc_max_handlers, Config))
        end
    ).

env_int_rejects_a_non_integer_value_test() ->
    with_env("VOXR_GATEWAY_HTTP_RPC_MAX_CONCURRENCY", "abc", fun() ->
        ?assertError(
            {invalid_integer_env, "VOXR_GATEWAY_HTTP_RPC_MAX_CONCURRENCY", "abc"},
            voxr_gateway_config:load()
        )
    end).

env_int_falls_back_to_the_default_for_an_empty_value_test() ->
    with_env("VOXR_GATEWAY_HTTP_RPC_MAX_CONCURRENCY", "", fun() ->
        Config = voxr_gateway_config:load(),
        ?assertEqual(512, maps:get(gateway_http_rpc_max_concurrency, Config))
    end).

rpc_concurrency_key_defaults_test() ->
    Config = voxr_gateway_config:build_config(#{}),
    ?assertEqual(512, maps:get(gateway_nats_rpc_max_handlers, Config)),
    ?assertEqual(512, maps:get(gateway_http_rpc_max_concurrency, Config)).

optional_string_test() ->
    ?assertEqual(undefined, voxr_gateway_config:optional_string(undefined)),
    ?assertEqual("hello", voxr_gateway_config:optional_string(<<"hello">>)),
    ?assertEqual("", voxr_gateway_config:optional_string(<<>>)).

public_endpoints_env_non_default_port_test() ->
    with_envs(
        [
            {"VOXR_BASE_DOMAIN", "voxr.example"},
            {"VOXR_PUBLIC_SCHEME", "https"},
            {"VOXR_PUBLIC_PORT", "8443"},
            {"VOXR_GATEWAY_MEDIA_PROXY_ENDPOINT", "https://voxr.example/media"},
            {"VOXR_GATEWAY_STATIC_CDN_ENDPOINT", "https://voxr.example"}
        ],
        fun() ->
            Config = voxr_gateway_config:load(),
            ?assertEqual(
                <<"https://voxr.example:8443/media">>,
                maps:get(media_proxy_endpoint, Config)
            ),
            ?assertEqual(
                <<"https://voxr.example:8443">>, maps:get(static_cdn_endpoint, Config)
            )
        end
    ).

public_endpoints_env_default_port_test() ->
    with_envs(
        [
            {"VOXR_BASE_DOMAIN", "voxr.example"},
            {"VOXR_PUBLIC_SCHEME", "https"},
            {"VOXR_PUBLIC_PORT", "443"},
            {"VOXR_GATEWAY_MEDIA_PROXY_ENDPOINT", "https://voxr.example/media"},
            {"VOXR_GATEWAY_STATIC_CDN_ENDPOINT", "https://cdn.othercdn.net"}
        ],
        fun() ->
            Config = voxr_gateway_config:load(),
            ?assertEqual(
                <<"https://voxr.example/media">>, maps:get(media_proxy_endpoint, Config)
            ),
            ?assertEqual(
                <<"https://cdn.othercdn.net">>, maps:get(static_cdn_endpoint, Config)
            )
        end
    ).

public_endpoints_defaults_test() ->
    Config = voxr_gateway_config:build_config(#{}),
    ?assertEqual(undefined, maps:get(media_proxy_endpoint, Config)),
    ?assertEqual(<<"http://localhost:8088">>, maps:get(static_cdn_endpoint, Config)).

with_envs([], Fun) ->
    Fun();
with_envs([{Name, Value} | Rest], Fun) ->
    with_env(Name, Value, fun() -> with_envs(Rest, Fun) end).

with_env(Name, Value, Fun) ->
    Previous = os:getenv(Name),
    os:putenv(Name, Value),
    try
        Fun()
    after
        restore_env(Name, Previous)
    end.

restore_env(Name, false) ->
    os:unsetenv(Name);
restore_env(Name, Previous) ->
    os:putenv(Name, Previous).
