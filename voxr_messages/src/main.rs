// SPDX-License-Identifier: AGPL-3.0-or-later

use voxr_messages::router_impl::MessagesRouter;
use voxr_messages::shard_impl::MessagesShard;
use voxr_svc::config::{DatabaseBackend, Mode, ServiceConfig};
use voxr_svc::transport::NatsTransport;

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
        "starting messages service"
    );

    match config.mode {
        Mode::Router => {
            let router = MessagesRouter::new();
            voxr_svc::router::run_router(&config, router, transport).await
        }
        Mode::Shard => {
            let shard = match config.database_backend {
                DatabaseBackend::Postgres => {
                    let postgres_config =
                        voxr_svc::postgres::PostgresConfig::from_service_config(&config);
                    let pool = voxr_svc::postgres::connect(&postgres_config).await?;
                    let kv = voxr_svc::postgres::KvClient::new(pool, &postgres_config)?;
                    MessagesShard::new_postgres(kv, transport.clone())?
                }
                DatabaseBackend::Cassandra => {
                    #[cfg(feature = "scylla")]
                    {
                        let scylla_config =
                            voxr_svc::scylla::ScyllaConfig::from_service_config(&config);
                        let db = voxr_svc::scylla::connect(&scylla_config).await?;
                        MessagesShard::new_scylla(db, transport.clone()).await?
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
