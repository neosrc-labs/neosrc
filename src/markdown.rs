use leptos::prelude::*;

fn render_markdown(input: String) -> String {
    let parser = pulldown_cmark::Parser::new_ext(&input, pulldown_cmark::Options::all());
    let mut html_output = String::new();
    pulldown_cmark::html::push_html(&mut html_output, parser);

    // TODO: Sanitize html?

    html_output
}
#[component]
pub fn Markdown(
    #[prop(into)] content: String,
    #[prop(into, default = String::new())] class: String,
) -> impl IntoView {
    let content = render_markdown(content);
    view! {
      <div class=format!("{class}")>{leptos::html::div().inner_html(content)}</div>
    }
}
