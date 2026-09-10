// SPDX-License-Identifier: AGPL-3.0-or-later

mod generator;
mod router_impl;
mod shard_impl;
mod types;

use voxr_svc::config::{Mode, ServiceConfig};
use voxr_svc::transport::NatsTransport;
use shard_impl::SnowflakesShard;
use types::SERVICE_NAME;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    voxr_svc::init_tracing();
    let config = ServiceConfig::from_env()?;
    let transport =
        NatsTransport::connect(&config.nats_url, config.nats_auth_token.as_deref()).await?;
    tracing::info!(
        service = SERVICE_NAME,
        mode = ?config.mode,
        shard_id = config.shard_id,
        shard_count = config.shard_count,
        listen_addr = %config.listen_addr,
        "starting snowflakes service"
    );
    match config.mode {
        Mode::Router => router_impl::run_round_robin_router(&config, transport).await,
        Mode::Shard => {
            let shard = SnowflakesShard::new(config.shard_id)?;
            voxr_svc::shard::run_shard(&config, shard, transport).await
        }
    }
}
