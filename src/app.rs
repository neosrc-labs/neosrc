use leptos::prelude::*;
use leptos::Params;
use leptos_meta::{provide_meta_context, Stylesheet, Title};
use leptos_router::hooks::use_params;
use leptos_router::params::Params;
use leptos_router::path;
use leptos_router::{
    components::{Route, Router, Routes},
    WildcardSegment,
};
use octocrab::models::pulls::PullRequest;
use octocrab::models::repos::RepoCommit;
use octocrab::models::{checks::CheckRun, IssueState};
use serde::{Deserialize, Serialize};

use crate::markdown::Markdown;

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
                    Some(
                        view! {
                            <div style="display: flex; flex-direction: column; height: 98vh; overflow: hidden;">
                                <div style="flex-shrink: 0;">
                                    <Header owner=owner repo=repo />
                                </div>
                                <div style="display: flex; gap: 1em; flex-grow: 1; min-height: 0;">
                                    <div style="flex-shrink: 0; width: 250px; height: 98%;">
                                        <Sidebar pull_request=data.pull_request.clone() />
                                    </div>
                                    <div style="flex-grow: 1; overflow-y: auto; overflow-x: hidden; height: 100%; padding-right: 1em;">
                                        <MainContent pull_request=data.pull_request.clone() />
                                    </div>
                                    <div style="flex-shrink: 0; width: 300px; overflow-y: auto; height: 100%; display: flex; flex-direction: column; gap: 1em;">
                                        <Checks checks=data.checks />
                                        <Commits commits=data.commits />
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
fn Checks(#[prop(into)] checks: Signal<Vec<CheckRun>>) -> impl IntoView {
    view! {
        <div style="padding: 1em; border: 1px solid #e1e4e8; border-radius: 6px; background: #f6f8fa;">
            <div style="font-weight: bold; margin-bottom: 0.5em;">"Checks"</div>
            <div style="display: flex; flex-direction: column; gap: 0.25em;">
                {checks
                    .get()
                    .into_iter()
                    .map(|check| view! {
                        <div style="padding: 0.25em 0; font-size: 0.9em;">{check.name.clone()}</div>
                    })
                    .collect_view()}
            </div>
        </div>
    }
}

#[component]
fn Metadata(#[prop(into)] pull_request: Signal<PullRequest>) -> impl IntoView {
    view! {
        <div style="padding: 1em; border: 1px solid #e1e4e8; border-radius: 6px; background: #f6f8fa;">
            <div style="margin-bottom: 1em; font-weight: bold">"Metadata"</div>
            <div style="margin-bottom: 0.5em; font-weight: 500;">"Labels"</div>
            <div style="display: flex; flex-direction: column; gap: 0.25em;">
                {pull_request
                    .get()
                    .labels
                    .unwrap_or_default()
                    .iter()
                    .map(|label| {
                        view! {
                            <div style="padding: 0.25em 0.5em; background: #e1e4e8; border-radius: 12px; font-size: 0.8em; width: fit-content;">
                                {label.name.clone()}
                            </div>
                        }
                    })
                    .collect_view()}
            </div>
        </div>
    }
}

#[component]
fn Commits(#[prop(into)] commits: Signal<Vec<RepoCommit>>) -> impl IntoView {
    view! {
        <div style="padding: 1em; border: 1px solid #e1e4e8; border-radius: 6px; background: #f6f8fa;">
            <div style="margin-bottom: 1em; font-weight: bold">"Commits"</div>
            <div style="display: flex; flex-direction: column; gap: 0.5em;">
                {commits
                    .get()
                    .iter()
                    .map(|commit| {
                        let message = commit
                            .commit
                            .message
                            .lines()
                            .into_iter()
                            .next()
                            .unwrap_or_default();
                        view! {
                            <div style="padding: 0.5em; background: white; border-radius: 4px; border-left: 3px solid #0366d6; font-size: 0.9em;">
                                {message}
                            </div>
                        }
                    })
                    .collect_view()}
            </div>
        </div>
    }
}

#[component]
fn Header(owner: impl Fn() -> String, repo: impl Fn() -> String) -> impl IntoView {
    view! {
        <div style="padding: 1em; border-bottom: 1px solid #e1e4e8; background: #f6f8fa;">
            <div style="display: flex; gap: 1em; margin-bottom: 1em; align-items: center">
                <a href=format!("https://github.com/{}", owner()) style="color: #0366d6; text-decoration: none; font-weight: 600;">{owner()}</a>
                <p style="margin: 0; color: #586069;">{"/"}</p>
                <a href=format!("https://github.com/{}/{}", owner(), repo()) style="color: #0366d6; text-decoration: none; font-weight: 600;">{repo()}</a>
            </div>
            <div style="display: flex; gap: 2em">
                <a href=format!("https://github.com/{}/{}", owner(), repo()) style="color: #586069; text-decoration: none; padding: 0.5em 0;">"Code"</a>
                <a href=format!("https://github.com/{}/{}/issues", owner(), repo()) style="color: #586069; text-decoration: none; padding: 0.5em 0;">"Issues"</a>
                <a href=format!("https://github.com/{}/{}/pulls", owner(), repo()) style="color: #586069; text-decoration: none; padding: 0.5em 0;">"Pull requests"</a>
            </div>
        </div>
    }
}

#[component]
fn Sidebar(#[prop(into)] pull_request: Signal<PullRequest>) -> impl IntoView {
    view! {
        <div style="height: 100%; display: flex; flex-direction: column; padding: 1em; gap: 1em;">
            <div style="display: flex; flex-direction: column; gap: 1em;">
                <div style="padding: 0.75em; background: #f1f3f4; border-radius: 6px; cursor: pointer; border: 1px solid transparent; transition: all 0.2s;"
                     onmouseover="this.style.backgroundColor='#e1e4e8'; this.style.borderColor='#d0d7de';"
                     onmouseout="this.style.backgroundColor='#f1f3f4'; this.style.borderColor='transparent';">
                    "Conversation"
                </div>
                <div style="padding: 0.75em; background: #f1f3f4; border-radius: 6px; cursor: pointer; border: 1px solid transparent; transition: all 0.2s;"
                     onmouseover="this.style.backgroundColor='#e1e4e8'; this.style.borderColor='#d0d7de';"
                     onmouseout="this.style.backgroundColor='#f1f3f4'; this.style.borderColor='transparent';">
                    "Files changed"
                </div>
            </div>
            <div style="flex-grow: 1; margin: 1em 0;">
                <Metadata pull_request=pull_request />
            </div>
            <div style="display: flex; flex-direction: column; gap: 0.5em; margin-top: auto;">
                <button style="padding: 0.75em; background: #dc3545; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500; transition: background-color 0.2s;"
                        onmouseover="this.style.backgroundColor='#c82333';"
                        onmouseout="this.style.backgroundColor='#dc3545';">
                    "Request Changes"
                </button>
                <button style="padding: 0.75em; background: #28a745; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500; transition: background-color 0.2s;"
                        onmouseover="this.style.backgroundColor='#218838';"
                        onmouseout="this.style.backgroundColor='#28a745';">
                    "Approve"
                </button>
                <button style="padding: 0.75em; background: #6f42c1; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500; transition: background-color 0.2s;"
                        onmouseover="this.style.backgroundColor='#5a2d91';"
                        onmouseout="this.style.backgroundColor='#6f42c1';">
                    "Merge"
                </button>
            </div>
        </div>
    }
}

#[component]
fn MainContent(#[prop(into)] pull_request: Signal<PullRequest>) -> impl IntoView {
    let pull_request = move || pull_request.get();
    let pr_number = || pull_request().number;
    view! {
        <div style="padding: 1em;">
            <div style="display: flex; align-items: center; gap: 1em; margin-bottom: 1em;">
                <h1 style="margin: 0; font-size: 2em; font-weight: 400;">{pull_request().title.clone()}</h1>
                <div style="color: #586069; font-size: 1.2em;">{"#"}{pr_number()}</div>
            </div>
            <div style="margin-bottom: 2em;">
                <StatusPill pull_request=pull_request().clone() />
            </div>
            <div style="line-height: 1.6; max-width: none;">
                <Markdown content=pull_request().body.unwrap_or_default() />
            </div>
        </div>
    }
}

#[component]
fn StatusPill(pull_request: PullRequest) -> impl IntoView {
    let (status, color) = if pull_request.merged_at.is_some() {
        ("Merged".to_string(), "#6f42c1")
    } else if pull_request.draft.unwrap_or(false) {
        // draft is an Option<bool>
        ("Draft".to_string(), "#6a737d")
    } else if pull_request.state == Some(IssueState::Open) {
        ("Open".to_string(), "#28a745")
    } else if pull_request.state == Some(IssueState::Closed) {
        ("Closed".to_string(), "#d73a49")
    } else {
        // Fallback for any other unexpected states
        (
            format!("Unknown State ({:?})", pull_request.state),
            "#6a737d",
        )
    };
    view! {
        <div style=format!(
            "background: {color}; padding: 0.5em 1em; width: fit-content; border-radius: 1.5em; color: white; font-weight: 600; font-size: 0.9em",
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
