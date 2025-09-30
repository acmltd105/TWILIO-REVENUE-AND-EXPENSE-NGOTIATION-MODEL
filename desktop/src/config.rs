use std::env;

#[derive(Debug, Clone)]
pub struct Config {
    pub base_url: String,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            base_url: env::var("NEGOTIATION_API_BASE").unwrap_or_else(|_| "http://localhost:8000/api/v1".to_string()),
        }
    }
}
