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
use serde::{Deserialize, Serialize};

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
                            <div style="display: flex; align-items: center; gap: 1em">
                                <h1>{data.title}</h1>
                                <div>{"#"}{pr_number}</div>
                            </div>
                            <p>{data.body}</p>
                        },
                    )
                }
            }}
        </Suspense>
    }
}

#[derive(Serialize, Deserialize, Clone)]
pub struct PullRequestPageData {
    title: String,
    body: Option<String>,
}

#[server]
pub async fn fetch_page_data(
    owner: String,
    repo: String,
    pr_number: u64,
) -> Result<PullRequestPageData, ServerFnError> {
    println!("fetching pr {pr_number}");
    let pull_request = octocrab::instance()
        .pulls(owner, repo)
        .get(pr_number)
        .await
        .inspect_err(|e| println!("{e:#?}"))?;

    Ok(PullRequestPageData {
        title: pull_request.title.unwrap_or_default(),
        body: pull_request.body,
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
