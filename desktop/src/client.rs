use anyhow::Result;
use reqwest::Client;
use serde::Deserialize;

use crate::config::Config;

#[derive(Debug, Deserialize, Clone)]
pub struct NegotiationPayload {
    pub currency: String,
    pub revenue: f64,
    pub expense: f64,
    pub target_margin: f64,
    pub floor_margin: f64,
    pub ceiling_margin: f64,
    pub target_discount: f64,
    pub floor_discount: f64,
    pub ceiling_discount: f64,
}

#[derive(Debug, Deserialize, Clone)]
pub struct HealthPayload {
    pub supabase_online: bool,
    pub twilio_online: bool,
    pub cached_notifications: i64,
    pub generated_at: String,
}

pub struct NegotiationClient {
    config: Config,
    http: Client,
}

impl NegotiationClient {
    pub fn new(config: Config) -> Self {
        Self {
            config,
            http: Client::builder().build().expect("client"),
        }
    }

    pub async fn negotiation(&self) -> Result<NegotiationPayload> {
        let url = format!("{}/negotiation", self.config.base_url);
        let response = self.http.get(url).send().await?;
        Ok(response.json::<NegotiationPayload>().await?)
    }

    pub async fn health(&self) -> Result<HealthPayload> {
        let url = format!("{}/health", self.config.base_url);
        let response = self.http.get(url).send().await?;
        Ok(response.json::<HealthPayload>().await?)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_config_points_to_localhost() {
        let config = Config::default();
        assert!(config.base_url.contains("localhost"));
    }
}
