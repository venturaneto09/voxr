// SPDX-License-Identifier: AGPL-3.0-or-later

mod router_impl;
mod shard_impl;
mod types;

use voxr_svc::config::{DatabaseBackend, Mode, ServiceConfig};
use voxr_svc::transport::NatsTransport;
use router_impl::UsersRouter;
use shard_impl::UsersShard;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    voxr_svc::init_tracing();
    let config = ServiceConfig::from_env()?;
    let transport =
        NatsTransport::connect(&config.nats_url, config.nats_auth_token.as_deref()).await?;

    tracing::info!(
        service = config.service_name,
        mode = ?config.mode,
        shard_id = config.shard_id,
        shard_count = config.shard_count,
        listen_addr = %config.listen_addr,
        "starting users service"
    );

    match config.mode {
        Mode::Router => {
            let router = UsersRouter::new(config.cache_max_entries, config.cache_ttl);
            voxr_svc::router::run_router(&config, router, transport).await
        }
        Mode::Shard => {
            let shard = match config.database_backend {
                DatabaseBackend::Postgres => {
                    let postgres_config =
                        voxr_svc::postgres::PostgresConfig::from_service_config(&config);
                    let pool = voxr_svc::postgres::connect(&postgres_config).await?;
                    let kv = voxr_svc::postgres::KvClient::new(pool, &postgres_config)?;
                    UsersShard::new_postgres(
                        kv,
                        transport.clone(),
                        config.cache_max_entries,
                        config.cache_ttl,
                    )?
                }
                DatabaseBackend::Cassandra => {
                    #[cfg(feature = "scylla")]
                    {
                        let scylla_config =
                            voxr_svc::scylla::ScyllaConfig::from_service_config(&config);
                        let db = voxr_svc::scylla::connect(&scylla_config).await?;
                        UsersShard::new_scylla(
                            db,
                            transport.clone(),
                            config.cache_max_entries,
                            config.cache_ttl,
                        )
                        .await?
                    }
                    #[cfg(not(feature = "scylla"))]
                    {
                        anyhow::bail!(
                            "VOXR_DATABASE_BACKEND=cassandra requires the scylla feature"
                        );
                    }
                }
            };
            voxr_svc::shard::run_shard(&config, shard, transport).await
        }
    }
}
