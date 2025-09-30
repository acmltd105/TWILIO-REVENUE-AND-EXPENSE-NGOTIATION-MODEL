mod client;
mod config;

use anyhow::Result;
use clap::Parser;
use colored::*;
use tokio::runtime::Runtime;

use client::NegotiationClient;
use config::Config;

#[derive(Parser, Debug)]
#[command(author, version, about = "Twilio negotiation desktop console", long_about = None)]
struct Args {
    #[arg(short, long, default_value = "true")]
    pretty: bool,
}

fn main() -> Result<()> {
    let args = Args::parse();
    let runtime = Runtime::new()?;
    let config = Config::default();
    let client = NegotiationClient::new(config.clone());

    let envelope = runtime.block_on(client.negotiation());
    let health = runtime.block_on(client.health());

    match (envelope, health) {
        (Ok(envelope), Ok(health)) => {
            render_dashboard(&config, &envelope, &health, args.pretty);
        }
        (negotiation, health) => {
            eprintln!("{}", "Failed to fetch negotiation data".red().bold());
            if let Err(err) = negotiation {
                eprintln!("Negotiation error: {err}");
            }
            if let Err(err) = health {
                eprintln!("Health error: {err}");
            }
        }
    }

    Ok(())
}

fn render_dashboard(
    config: &Config,
    envelope: &client::NegotiationPayload,
    health: &client::HealthPayload,
    pretty: bool,
) {
    println!("{}", "Twilio Negotiation Snapshot".bright_cyan().bold());
    println!("Endpoint: {}", config.base_url.underline());
    println!("Currency: {}", envelope.currency);
    println!("Revenue: {:.2}", envelope.revenue);
    println!("Expense: {:.2}", envelope.expense);
    println!(
        "Target Margin: {:.2}% (Floor {:.2}% / Ceiling {:.2}%)",
        envelope.target_margin * 100.0,
        envelope.floor_margin * 100.0,
        envelope.ceiling_margin * 100.0
    );
    println!(
        "Discounts - Target {:.2}% / Floor {:.2}% / Ceiling {:.2}%",
        envelope.target_discount * 100.0,
        envelope.floor_discount * 100.0,
        envelope.ceiling_discount * 100.0
    );

    if pretty {
        println!(
            "Health: Supabase {} | Twilio {} | Cached Notifications {}",
            status_badge(health.supabase_online),
            status_badge(health.twilio_online),
            health.cached_notifications
        );
        println!("Last Sync: {}", health.generated_at);
    } else {
        println!(
            "Health: supabase_online={} twilio_online={} cached_notifications={}",
            health.supabase_online, health.twilio_online, health.cached_notifications
        );
        println!("last_sync={}", health.generated_at);
    }
}

fn status_badge(active: bool) -> ColoredString {
    if active {
        "ONLINE".green().bold()
    } else {
        "DEGRADED".yellow().bold()
    }
}
