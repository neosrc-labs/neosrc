use leptos::prelude::*;
use leptos_meta::{provide_meta_context, Stylesheet, Title};
use leptos_router::hooks::use_params;
use leptos_router::path;
use leptos_router::{
    components::{Route, Router, Routes},
    WildcardSegment,
};

#[component]
pub fn App() -> impl IntoView {
    // Provides context that manages stylesheets, titles, meta tags, etc.
    provide_meta_context();

    view! {
        // injects a stylesheet into the document <head>
        // id=leptos means cargo-leptos will hot-reload this stylesheet
        <Stylesheet id="leptos" href="/pkg/dub.css" />

        // sets the document title
        <Title text="Welcome to Leptos" />

        // content for this welcome page
        <Router>
            <main>
                <Routes fallback=move || "Not found.">
                    <Route path=path!("/:owner/:repo/pull/:id") view=PullRequestPage />
                    <Route path=WildcardSegment("any") view=NotFound />
                </Routes>
            </main>
        </Router>
    }
}
use leptos::Params;
use leptos_router::params::Params;
use octocrab::models::pulls::PullRequest;
use octocrab::models::repos::RepoCommit;
use octocrab::models::{checks::CheckRun, IssueState};
use serde::{Deserialize, Serialize};

use crate::markdown::Markdown;

#[derive(Params, PartialEq)]
struct PullRequestParams {
    owner: Option<String>,
    repo: Option<String>,
    id: Option<u64>,
}

#[component]
fn PullRequestPage() -> impl IntoView {
    let params = use_params::<PullRequestParams>();
    let owner = move || {
        params
            .read()
            .as_ref()
            .ok()
            .and_then(|params| params.owner.clone())
            .unwrap_or_default()
    };
    let repo = move || {
        params
            .read()
            .as_ref()
            .ok()
            .and_then(|params| params.repo.clone())
            .unwrap_or_default()
    };
    let pr_number = move || {
        params
            .read()
            .as_ref()
            .ok()
            .and_then(|params| params.id)
            .unwrap_or_default()
    };

    let page_data = Resource::new(
        move || (owner(), repo(), pr_number()),
        |(owner, repo, pr_number)| async move { fetch_page_data(owner, repo, pr_number).await.unwrap() },
    );

    view! {
        <Suspense fallback=move || {
            view! { <p>"Loading..."</p> }
        }>
            {move || match page_data.get() {
                None => None,
                Some(data) => {
                    let pr = move || data.pull_request.clone();
                    Some(
                        view! {
                            <div style="display: flex; flex-direction: column; height: 100vh">
                                <Header owner=owner repo=repo />
                                <div style="display: flex; margin-top: 0.5em; gap: 1em; flex-grow: 1">
                                    <div>
                                        <Sidebar checks=move || data.checks.clone() />
                                    </div>
                                    <div>
                                        <MainContent pull_request=pr.clone() />
                                    </div>
                                    <div style="display: flex; flex-direction: column; gap: 1em;">
                                        <Metadata pull_request=pr.clone() />
                                        <Commits commits=move || data.commits.clone() />
                                    </div>
                                </div>
                            </div>
                        },
                    )
                }
            }}
        </Suspense>
    }
}

#[component]
fn Metadata(pull_request: impl Fn() -> PullRequest) -> impl IntoView {
    view! {
        <div>
            <div style="margin-bottom: 1em; font-weight: bold">"Metadata"</div>
            <div>"Labels"</div>
            <div>
                {pull_request()
                    .labels
                    .unwrap_or_default()
                    .iter()
                    .map(|label| {
                        view! { <div>{label.name.clone()}</div> }
                    })
                    .collect_view()}
            </div>
        </div>
    }
}

#[component]
fn Commits(commits: impl Fn() -> Vec<RepoCommit>) -> impl IntoView {
    view! {
        <div>
            <div style="margin-bottom: 1em; font-weight: bold">"Commits"</div>
            {commits()
                .iter()
                .map(|commit| {
                    let message = commit
                        .commit
                        .message
                        .lines()
                        .into_iter()
                        .next()
                        .unwrap_or_default();
                    view! { <div style="margin-bottom: 0.5em">{message}</div> }
                })
                .collect_view()}
        </div>
    }
}

#[component]
fn Header(owner: impl Fn() -> String, repo: impl Fn() -> String) -> impl IntoView {
    view! {
        <div style="display: flex; gap: 1em; margin-bottom: 1em; align-items: center">
            <a href=format!("https://github.com/{}", owner())>{owner()}</a>
            <p>{"/"}</p>
            <a href=format!("https://github.com/{}/{}", owner(), repo())>{repo()}</a>
        </div>
        <div style="display: flex; gap: 1em">
            <a href=format!("https://github.com/{}/{}", owner(), repo())>"Code"</a>
            <a href=format!("https://github.com/{}/{}/issues", owner(), repo())>"Issues"</a>
            <a href=format!("https://github.com/{}/{}/pulls", owner(), repo())>"Pull requests"</a>
        </div>
    }
}

#[component]
fn Sidebar(checks: impl Fn() -> Vec<CheckRun>) -> impl IntoView {
    view! {
        <div style="height: 97%; display: flex; flex-direction: column; justify-content: space-between">
            <div style="display: flex; flex-direction: column; gap: 1em; margin-top: 1em">
                <div>"Conversations"</div>
                <div>"Files changed"</div>
            </div>
            <div>
                <strong>"Checks"</strong>
                {checks()
                    .into_iter()
                    .map(|check| view! { <div>{check.name.clone()}</div> })
                    .collect_view()}
            </div>
            <div>
                <div style="color: red">"Request Changes"</div>
                <div style="color: green">"Approve"</div>
                <div style="color: purple">"Merge"</div>
            </div>
        </div>
    }
}

#[component]
fn MainContent(pull_request: impl Fn() -> PullRequest) -> impl IntoView {
    let pr_number = || pull_request().number;
    view! {
        <div style="display: flex; align-items: center; gap: 1em">
            <h1>{pull_request().title.clone()}</h1>
            <div>{"#"}{pr_number()}</div>
        </div>
        <StatusPill pull_request=pull_request().clone() />
        <Markdown content=pull_request().body.unwrap_or_default() />
    }
}

#[component]
fn StatusPill(pull_request: PullRequest) -> impl IntoView {
    let (status, color) = if pull_request.merged_at.is_some() {
        ("Merged".to_string(), "purple")
    } else if pull_request.draft.unwrap_or(false) {
        // draft is an Option<bool>
        ("Draft".to_string(), "gray")
    } else if pull_request.state == Some(IssueState::Open) {
        ("Open".to_string(), "green")
    } else if pull_request.state == Some(IssueState::Closed) {
        ("Closed".to_string(), "red")
    } else {
        // Fallback for any other unexpected states
        (format!("Unknown State ({:?})", pull_request.state), "")
    };
    view! {
        <div style=format!(
            "background: {color}; padding: 0.5em 1em; width: fit-content; border-radius: 1.5em; color: white; font-weight: bold",
        )>{status}</div>
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PullRequestPageData {
    pull_request: PullRequest,
    checks: Vec<CheckRun>,
    commits: Vec<RepoCommit>,
}

#[server]
pub async fn fetch_page_data(
    owner: String,
    repo: String,
    pr_number: u64,
) -> Result<PullRequestPageData, ServerFnError> {
    println!("fetching pr {pr_number}");

    let client = octocrab::Octocrab::builder()
        .user_access_token(std::env::var("GITHUB_API_TOKEN")?)
        .build()?;

    let pull_request = client
        .pulls(&owner, &repo)
        .get(pr_number)
        .await
        .inspect_err(|e| println!("{e:#?}"))?;

    println!("SHA: {}", pull_request.head.sha);

    let checks = client
        .checks(&owner, &repo)
        .list_check_runs_for_git_ref(pull_request.head.sha.clone().into())
        .send()
        .await
        .inspect_err(|e| println!("{e:#?}"))?;

    let commits = client
        .pulls(&owner, &repo)
        .pr_commits(pr_number)
        .send()
        .await
        .inspect_err(|e| println!("{e:#?}"))?;

    Ok(PullRequestPageData {
        pull_request,
        checks: checks.check_runs,
        commits: commits.items,
    })
}

/// 404 - Not Found
#[component]
fn NotFound() -> impl IntoView {
    // set an HTTP status code 404
    // this is feature gated because it can only be done during
    // initial server-side rendering
    // if you navigate to the 404 page subsequently, the status
    // code will not be set because there is not a new HTTP request
    // to the server
    #[cfg(feature = "ssr")]
    {
        // this can be done inline because it's synchronous
        // if it were async, we'd use a server function
        let resp = expect_context::<leptos_actix::ResponseOptions>();
        resp.set_status(actix_web::http::StatusCode::NOT_FOUND);
    }

    view! { <h1>"Not Found"</h1> }
}
