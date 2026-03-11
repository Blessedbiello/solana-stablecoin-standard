#![no_std]

/// Maximum basis points (100%).
pub const MAX_BPS: u64 = 10_000;

/// Calculate a percentage of an amount using basis points.
/// Returns `None` on overflow.
pub fn apply_bps(amount: u64, bps: u64) -> Option<u64> {
    (amount as u128)
        .checked_mul(bps as u128)?
        .checked_div(MAX_BPS as u128)
        .map(|v| v as u64)
}

/// Check whether `used + amount` would exceed `allowance`.
pub fn check_quota(used: u64, amount: u64, allowance: u64) -> bool {
    match used.checked_add(amount) {
        Some(total) => total <= allowance,
        None => false,
    }
}

/// Absolute difference between two u64 values.
pub fn abs_diff(a: u64, b: u64) -> u64 {
    if a > b { a - b } else { b - a }
}

/// Check if deviation exceeds threshold in basis points.
/// `actual` and `target` are in the same units.
pub fn exceeds_deviation(actual: u64, target: u64, threshold_bps: u64) -> bool {
    if target == 0 {
        return actual != 0;
    }
    let diff = abs_diff(actual, target);
    // diff / target > threshold_bps / MAX_BPS
    // => diff * MAX_BPS > threshold_bps * target (avoiding division)
    let lhs = (diff as u128) * (MAX_BPS as u128);
    let rhs = (threshold_bps as u128) * (target as u128);
    lhs > rhs
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_apply_bps() {
        assert_eq!(apply_bps(10_000, 500), Some(500)); // 5%
        assert_eq!(apply_bps(10_000, 10_000), Some(10_000)); // 100%
        assert_eq!(apply_bps(0, 5_000), Some(0));
        assert_eq!(apply_bps(1, 1), Some(0)); // rounds down
    }

    #[test]
    fn test_check_quota() {
        assert!(check_quota(0, 100, 100));
        assert!(check_quota(50, 50, 100));
        assert!(!check_quota(51, 50, 100));
        assert!(!check_quota(u64::MAX, 1, u64::MAX));
    }

    #[test]
    fn test_exceeds_deviation() {
        assert!(!exceeds_deviation(100, 100, 100)); // 0% deviation, 1% threshold
        assert!(exceeds_deviation(102, 100, 100));  // 2% deviation, 1% threshold
        assert!(!exceeds_deviation(101, 100, 100)); // 1% deviation, 1% threshold
    }
}
